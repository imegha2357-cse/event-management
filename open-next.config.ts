// Build settings for hosting on Cloudflare Workers (https://opennext.js.org/cloudflare).
// Every page is personal to the signed-in company, so no page cache is needed.
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig({});
