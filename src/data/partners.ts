/**
 * Partner campaign data for Meta Ads landing pages.
 *
 * Add new campaigns/partners here instead of creating new page templates.
 * URL pattern: /p/{partner.slug}/{campaign.slug}
 *
 * Only fill in property details that are actually available. Sections are
 * rendered conditionally from this file.
 */
export interface PartnerCampaign {
  slug: string;
  name: string;

  image?: string;
  imageAlt?: string;
  seoDescription?: string;

  type?: string;
  landSize?: string;
  buildingSize?: string;
  bedrooms?: string;
  bathrooms?: string;
  price?: string;
  location?: string;
  amenities?: string[];

  partnerContactUrl?: string;
  partnerContactLabel?: string;
}

export interface Partner {
  slug: string;
  name: string;
  campaigns: PartnerCampaign[];
}

export const partners: Partner[] = [];

export function findCampaign(partnerSlug: string, campaignSlug: string) {
  const partner = partners.find((p) => p.slug === partnerSlug);
  const campaign = partner?.campaigns.find((c) => c.slug === campaignSlug);
  return campaign && partner ? { partner, campaign } : undefined;
}