# Qraft

Make crisp pixel QR codes, ready to print or share.

*Version française : [README.md](README.md)*

![Qraft](screenshots/1.jpg)

## Phone version

- The QR code is on top, the settings below.
- Exported files are saved to the phone's Downloads/NeoDex folder.
- The same saved QR codes as on PC (same id `neodex.qraft`).

## Contents

- Free **Text** and **Link** (`https://` is added if missing).
- **Wi-Fi**: network name, password, security (WPA, WEP, none), hidden network. A phone that reads the code connects on its own. **The password is never saved**: not in the plugin folder, not in the recent list.
- **Contact** (vCard: name, phone, e-mail, company, website), **E-mail** (to, subject, message), **SMS**, **Location** (latitude, longitude).

## Settings

- **Correction** L, M, Q or H: the share of the code that can be damaged (or covered by a logo) without hurting reading, from 7 to 30 %. The stronger it is, the bigger the code.
- **Ink** and **background**: a pixel art palette or any colour. A warning shows if the ink is lighter than the background or the contrast is too low.
- **Margin** (4 modules recommended) and **module size** in pixels.
- The version (code size), the chosen mask and the space used are shown.

## Export

**PNG**, **SVG** (sharp at any size) or **Copy the image**. **★ Keep** puts the code in the **recent** list (10 at most) to find it again in one click.

## Reliability

The encoder follows the ISO 18004 standard (byte mode, versions 1 to 40, Reed-Solomon, 8 masks, the best one picked automatically). Each time it opens, test codes are made then read back by a small built-in decoder, which checks they give back the original text.

## Data

The content (without Wi-Fi password), the settings and the recent list are kept in the plugin folder. Permission: `storage` only.
