import React from "react";
import { Link } from "react-router-dom";
import { Badge } from "./ui/badge";
import { MapPin, Package, ShieldCheck } from "lucide-react";

const TYPE_LABELS = {
  raw_cotton: "Raw Cotton",
  recycled_cotton: "Recycled Cotton",
  yarn: "Yarn",
  fabric: "Fabric",
  blend: "Blend",
};

export const ListingCard = ({ listing }) => {
  return (
    <Link
      to={`/listings/${listing.id}`}
      data-testid={`listing-card-${listing.id}`}
      className="group block bg-white border border-edge rounded-lg overflow-hidden transition-all hover:-translate-y-1 hover:shadow-md"
    >
      <div className="aspect-[4/3] bg-bg-alt overflow-hidden">
        {listing.image_url && (
          <img
            src={listing.image_url}
            alt={listing.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
      </div>
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2 text-[10px] font-semibold tracking-widest uppercase text-ink-muted">
          <Package className="h-3 w-3" />
          <span>{TYPE_LABELS[listing.product_type] || listing.product_type}</span>
          <span className="text-edge">•</span>
          <MapPin className="h-3 w-3" />
          <span>{listing.origin}</span>
        </div>
        <h3 className="font-display text-lg font-medium text-ink-primary leading-snug line-clamp-2">
          {listing.title}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {listing.certifications?.slice(0, 3).map((c) => (
            <Badge
              key={c}
              className="bg-bg-alt text-brand border border-edge text-[10px] font-semibold px-2 py-0.5 rounded hover:bg-bg-alt"
            >
              {c}
            </Badge>
          ))}
        </div>
        <div className="flex items-end justify-between pt-2 border-t border-edge">
          <div>
            <div className="text-xs text-ink-muted">From</div>
            <div className="font-display text-xl font-bold text-ink-primary">
              ${listing.price_per_unit.toFixed(2)}
              <span className="text-sm font-normal text-ink-muted">/{listing.moq_unit}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-ink-muted">MOQ</div>
            <div className="text-sm font-semibold text-ink-secondary">
              {listing.moq.toLocaleString()} {listing.moq_unit}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-ink-muted">
          <span>{listing.seller_name}</span>
          {listing.seller_verified && (
            <span className="flex items-center gap-1 text-brand font-medium">
              <ShieldCheck className="h-3 w-3" /> Verified
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};
