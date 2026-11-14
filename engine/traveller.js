// One adapter for Homecraft, Terry's original site and the blog plugin.
// Owner-facing content stays independent of the visitor's appearance.
import { readSiteInfo, siteText } from './door-metadata.js';
import { createTravelSession } from './door-protocol.js';
const site = readSiteInfo(location.href);
// Visitors wear the default player unless they carry a skin through a portal;
// the owner's skin (config.skin) belongs to the owner's resident, not the player.
export const traveller = createTravelSession('', '', async () => siteText((await site)?.name));
export const wornSkin = () => traveller.wornSkin();
