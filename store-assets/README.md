# Chrome Web Store images

- `icon-128.png`: 128×128 listing icon, copied from the built extension.
- `pipeline-presets.png`: 1280×800 screenshot of the compiled extension on a
  sanitized local Run pipeline fixture. It uses demo values and no GitLab data.
- `promo-tile.png`: 440×280 promotional image.

Regenerate all three after changing the icon or UI:

```sh
npm run build
node scripts/create-store-assets.mjs
```

The generator uses an installed Chrome browser. Set `CHROME_PATH` if Chrome is
not installed at its default Windows path. Review the generated screenshot
before uploading it to the Store.
