## My first project btw :)

Hope you guys like it...

# Dark Mode Theme Changer

Automatically change theme styles when dark mode is enabled or disabled.

## Screenshot

![preferences](https://raw.githubusercontent.com/Lynixx01/DmThemeChanger/master/resources/screenshots/preview.png)

# Installation

Install the `Dark Mode Theme Changer` by running the following commands:

    wget https://github.com/Lynixx01/DmThemeChanger/releases/download/v1.0/darkmode-theme-changer@lynixx01.github.com.zip
    gnome-extensions install --force darkmode-theme-changer@lynixx01.github.com.zip
    rm darkmode-theme-changer@lynixx01.github.com.zip

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
