## My first project btw :)

Hope you guys like it...

# DM Theme Changer Reborn

Automatically change theme styles when dark mode is enabled or disabled.

## Screenshots

### Themes & Commands Settings
| Light Mode | Dark Mode |
| --- | --- |
| ![Preferences Light](images/config_ligth.png) | ![Preferences Dark](images/config_dark.png) |

### Wallpapers Settings
| Light Mode | Dark Mode |
| --- | --- |
| ![Wallpapers Light](images/wallpapers_ligth.png) | ![Wallpapers Dark](images/wallpapers_dark.png) |

# Installation

Install the `DM Theme Changer Reborn` by running the following commands:

    wget https://github.com/phenrique-coder/DmThemeChanger/releases/latest/download/dm-theme-changer-reborn@phenrique-coder.github.com.zip
    gnome-extensions install --force dm-theme-changer-reborn@phenrique-coder.github.com.zip
    rm dm-theme-changer-reborn@phenrique-coder.github.com.zip

# Building from source

You need to install `npm` or `yarn` for the dependencies.

Clone github repository && enter to the directory:

    git clone https://github.com/phenrique-coder/DmThemeChanger.git
    cd DmThemeChanger

Building:

    npm install
    npm run build

Installation:

    npm run install:extension

Testing:

    npm run dev:wayland

