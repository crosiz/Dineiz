declare global {
  interface Window {
    dataLayer: Record<string, any>[];
  }
}

export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || "GTM-DINEIZ";

export const trackEvent = (eventName: string, eventParams: Record<string, any> = {}) => {
  if (typeof window !== "undefined" && window.dataLayer) {
    window.dataLayer.push({
      event: eventName,
      ...eventParams,
    });
  }
};

export const trackConversion = {
  trialSignupClick: (location: string) =>
    trackEvent("trial_signup_click", { location }),
  pricingPageView: (plan?: string) =>
    trackEvent("pricing_page_view", { plan }),
  whatsappContactClick: (source: string) =>
    trackEvent("whatsapp_contact_click", { source }),
  downloadAppClick: (platform: string = "android") =>
    trackEvent("download_app_click", { platform }),
};
