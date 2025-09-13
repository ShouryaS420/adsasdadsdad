// src/vendors/providers/index.js
import { hostinger } from "../hostinger.js";
import { cloudflare } from "../cloudflare.js";
import { godaddy } from "../godaddy.js";
import { gcloud } from "../googleCloudDns.js";

export const PROVIDERS = {
    hostinger, cloudflare, godaddy, "google-cloud-dns": gcloud,
};
