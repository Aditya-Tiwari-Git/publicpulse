// Provider adapters may be implemented when credentials, consent and budgets are available.
// No external delivery provider is included or invoked in this proof of concept.
export type DeliveryChannel = "sms" | "whatsapp" | "ivr";
export interface SurveyDeliveryProvider {
  channel: DeliveryChannel;
  send(input: {
    destination: string;
    authorizedSurveyUrl: string;
    campaignId: string;
    consentReference: string;
  }): Promise<{ providerMessageId: string }>;
}
export function authorizedSurveyLink(origin: string, surveyId: string) {
  return new URL(`/collect/${encodeURIComponent(surveyId)}`, origin).href;
}
