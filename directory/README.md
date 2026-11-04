# Public Directory Maintenance

This directory is maintained only in the main Homecraft repository. Each website has a corresponding JSON file. Publishing generates `worlds.json` for portals to read.

Website authors should use the [Request listing](https://github.com/terryHu7/homecraft/issues/new/choose) form to submit their information. See the [public directory](../docs/worlds.md) guide for the steps.

## Maintenance

- Edit a website's JSON file to update its information; delete the file to remove the listing.
- `_settings.json` configures pinned order, hidden URLs and directory entry points. URLs in `blocked`, including their subpaths, are hidden.
- Availability checks run on each publication and every Monday. Unreachable websites are omitted from the published directory until a subsequent check succeeds.
- A failed logo or portal check leaves the website listed; the problem is recorded in the GitHub Actions summary.
