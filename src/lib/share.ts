/** Share channels the UI offers; /api/share rejects anything else. */
export const SHARE_CHANNELS = ["whatsapp", "x", "linkedin", "telegram", "copy_link", "native", "download"] as const;
export type ShareChannel = (typeof SHARE_CHANNELS)[number];
