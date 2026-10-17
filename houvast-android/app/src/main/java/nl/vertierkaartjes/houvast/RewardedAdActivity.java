package nl.vertierkaartjes.houvast;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.annotation.NonNull;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Native brug tussen de Houvast TWA en een AdMob rewarded advertentie.
 * De webapp start deze Activity via houvast://rewarded-ad.
 * Alleen als Google OnUserEarnedRewardListener aanroept, keren we terug met adReward=1.
 */
public final class RewardedAdActivity extends Activity {
    private static final String TAG = "HouvastRewardedAd";
    private static final String TEST_AD_UNIT_ID = "ca-app-pub-3940256099942544/5224354917";
    private static final String PROD_AD_UNIT_ID = "ca-app-pub-2229439226354979/1796238879";
    private static final String RETURN_URL = "https://app.vertierkaartjes.nl/";

    private final AtomicBoolean adsInitializationStarted = new AtomicBoolean(false);
    private TextView statusText;
    private boolean rewardEarned = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        showLoadingScreen("Advertentie voorbereiden…");
        requestConsentAndLoadAd();
    }

    private void showLoadingScreen(String message) {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(48, 48, 48, 48);
        root.setBackgroundColor(Color.rgb(245, 242, 236));

        ProgressBar progress = new ProgressBar(this);
        root.addView(progress, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT));

        statusText = new TextView(this);
        statusText.setText(message);
        statusText.setTextSize(18f);
        statusText.setTextColor(Color.rgb(36, 75, 63));
        statusText.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams textParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        textParams.topMargin = 28;
        root.addView(statusText, textParams);

        setContentView(root);
    }

    private void requestConsentAndLoadAd() {
        ConsentInformation consentInformation =
                UserMessagingPlatform.getConsentInformation(this);

        ConsentRequestParameters params =
                new ConsentRequestParameters.Builder().build();

        consentInformation.requestConsentInfoUpdate(
                this,
                params,
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(
                        this,
                        formError -> {
                            if (formError != null) {
                                Log.w(TAG, "Consent form: " + formError.getMessage());
                            }
                            if (consentInformation.canRequestAds()) {
                                initializeAndLoadAd();
                            } else {
                                failAndReturn("Advertenties kunnen nog niet worden geladen.");
                            }
                        }),
                requestConsentError -> {
                    Log.w(TAG, "Consent update: " + requestConsentError.getMessage());
                    if (consentInformation.canRequestAds()) {
                        initializeAndLoadAd();
                    } else {
                        failAndReturn("Privacy-instellingen konden niet worden geladen.");
                    }
                });

        if (consentInformation.canRequestAds()) {
            initializeAndLoadAd();
        }
    }

    private void initializeAndLoadAd() {
        if (!adsInitializationStarted.compareAndSet(false, true)) return;

        statusText.setText("Advertentie laden…");
        MobileAds.initialize(this, initializationStatus -> loadRewardedAd());
    }

    private void loadRewardedAd() {
        String adUnitId = BuildConfig.DEBUG ? TEST_AD_UNIT_ID : PROD_AD_UNIT_ID;
        AdRequest request = new AdRequest.Builder().build();

        RewardedAd.load(
                this,
                adUnitId,
                request,
                new RewardedAdLoadCallback() {
                    @Override
                    public void onAdLoaded(@NonNull RewardedAd rewardedAd) {
                        statusText.setText("Advertentie starten…");
                        showRewardedAd(rewardedAd);
                    }

                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                        Log.w(TAG, "Rewarded ad load failed: " + loadAdError);
                        failAndReturn("Er is nu geen advertentie beschikbaar. Probeer het later opnieuw.");
                    }
                });
    }

    private void showRewardedAd(RewardedAd rewardedAd) {
        rewardedAd.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdDismissedFullScreenContent() {
                returnToHouvast(rewardEarned, null);
            }

            @Override
            public void onAdFailedToShowFullScreenContent(@NonNull AdError adError) {
                Log.w(TAG, "Rewarded ad show failed: " + adError);
                failAndReturn("De advertentie kon niet worden geopend.");
            }
        });

        rewardedAd.show(this, rewardItem -> {
            rewardEarned = true;
            Log.d(TAG, "Reward earned: " + rewardItem.getAmount() + " " + rewardItem.getType());
        });
    }

    private void failAndReturn(String message) {
        statusText.setText(message);
        statusText.postDelayed(() -> returnToHouvast(false, "1"), 1400);
    }

    private void returnToHouvast(boolean earned, String error) {
        Uri.Builder builder = Uri.parse(RETURN_URL).buildUpon()
                .appendQueryParameter("adReward", earned ? "1" : "0");
        if (error != null) builder.appendQueryParameter("adError", error);

        Intent intent = new Intent(Intent.ACTION_VIEW, builder.build(), this, LauncherActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(intent);
        finish();
    }

    @Override
    public void onBackPressed() {
        returnToHouvast(false, null);
    }
}
