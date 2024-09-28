## My first project btw :)

Sorry for the mess code. Hope you guys like it...

# DM Theme Changer

Automatically change theme styles when dark mode is enabled or disabled.

## Screenshot

![preferences](https://raw.githubusercontent.com/Lynixx01/DmThemeChanger/master/resources/screenshots/preview.png)

# Installation

Install the `DM Theme Changer` by running the following commands:

    wget https://github.com/Lynixx01/DmThemeChanger/releases/latest/download/dm-theme-changer@lynixx01.github.com.zip
    gnome-extensions install --force dm-theme-changer@lynixx01.github.com.zip
    rm dm-theme-changer@lynixx01.github.com.zip

# Building from source

You need to install `yarn` for the dependencies.

Clone github repository && enter to the directory:

    git clone https://github.com/Lynixx01/DmThemeChanger.git
    cd DmThemeChanger

Building:

    yarn install
    yarn build

Installation:

    yarn install:extension

Testing:

    yarn dev:wayland
