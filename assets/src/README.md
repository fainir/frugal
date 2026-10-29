Sources for the README images. Regenerate after editing:

```bash
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CH" --headless=new --hide-scrollbars --force-device-scale-factor=2 --default-background-color=00000000 --window-size=1100,482 --screenshot=../demo.png "file://$PWD/demo.html"
"$CH" --headless=new --hide-scrollbars --window-size=1280,640 --allow-file-access-from-files --screenshot=../social-preview.png "file://$PWD/social.html"
```
