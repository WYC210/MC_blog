# Portal Plugin

Add a Homecraft portal to an existing website or blog.

1. Copy the entire `plugin/` directory to your site, e.g. as `/homecraft/`.
2. Add the following to your page:

   ```html
   <script type="module" src="/homecraft/homecraft-door.js"></script>
   <homecraft-door></homecraft-door>
   ```

| Attribute | Description |
|---|---|
| `lang="zh"` / `lang="en"` | Interface language; defaults to the page's language |

The plugin does not use cookies or provide accounts or analytics. See the [public directory](../docs/worlds.md) for instructions on requesting a listing.
