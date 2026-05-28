import GLib from "gi://GLib";
import Gio from "gi://Gio";
import St from "gi://St";
import Meta from "gi://Meta";
import Shell from "gi://Shell";
import Clutter from "gi://Clutter";

import { Extension, gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

import { getDirs, getModeThemeDirs } from "./utils.js";
import { OptimizeTransition } from "./others/darkLightSwitch.js";

let CURSOR_THEME_LIGHT;
let ICON_THEME_LIGHT;
let SHELL_THEME_LIGHT;
let GTK3_THEME_LIGHT;

let CURSOR_THEME_DARK;
let ICON_THEME_DARK;
let SHELL_THEME_DARK;
let GTK3_THEME_DARK;

let OPTIMIZE_DARKLIGHT_SWITCH_TRANSITION;

export default class DmThemeChangerReborn extends Extension {
  enable() {
    //get all settings
    this._settings = this.getSettings();
    this._interfaceSettings = new Gio.Settings({
      schema: "org.gnome.desktop.interface",
    });

    this._currentShellTheme = null;

    // Initilize source Ids handler
    this._sourceIds = {};

    this._sourceIds.interfaceSettings = this._interfaceSettings.connect(
      "changed",
      this._onInterfaceSettingsChanged.bind(this)
    );

    this._sourceIds.settings = this._settings.connect(
      "changed",
      this._onSettingsChanged.bind(this)
    );

    // TWEAKS
    this.optimizeTransition = new OptimizeTransition(this._settings);

    if (this._settings.get_boolean("optimize-darklight-switch-transition"))
      this.optimizeTransition.enable();

    const isFirstTimeInstall = this._settings.get_boolean("first-time-install");
    if (isFirstTimeInstall) this._firstTimeInstall();

    // Functions to run when enabled
    this._fetchAllSettings();
    this._changeAllTheme();
    this._handleExternalShellThemeChanged();

    // Register custom keybinding to toggle theme
    Main.wm.addKeybinding(
      "toggle-theme-shortcut",
      this._settings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.ALL,
      this._toggleDarkMode.bind(this)
    );

    // Show indicator if enabled
    if (this._settings.get_boolean("show-indicator")) {
      this._createIndicator();
    }
  }

  disable() {
    Main.wm.removeKeybinding("toggle-theme-shortcut");

    this._destroyIndicator();
    this._destroyExternalShellThemeHandler();

    this.optimizeTransition.disable();

    // Disconnect signal handlers and remove active timeouts
    if (this._sourceIds) {
      if (this._sourceIds.interfaceSettings && this._interfaceSettings) {
        this._interfaceSettings.disconnect(this._sourceIds.interfaceSettings);
      }
      if (this._sourceIds.settings && this._settings) {
        this._settings.disconnect(this._sourceIds.settings);
      }
      if (this._sourceIds.extensionStateChanged) {
        Main.extensionManager.disconnect(this._sourceIds.extensionStateChanged);
      }
      if (this._sourceIds.transitionDelayTimeout) {
        GLib.source_remove(this._sourceIds.transitionDelayTimeout);
      }
      if (this._sourceIds.changeIconsDelayTimeout) {
        GLib.source_remove(this._sourceIds.changeIconsDelayTimeout);
      }
      if (this._sourceIds.shellThemeDelayTimeout) {
        GLib.source_remove(this._sourceIds.shellThemeDelayTimeout);
      }
      if (this._sourceIds.SettingsWriteTimeout) {
        GLib.source_remove(this._sourceIds.SettingsWriteTimeout);
      }
    }

    this._currentShellTheme = null;
    this._sourceIds = null;
    this._settings = null;
    this._interfaceSettings = null;
    this._screensaverSettings = null;
    this._backgroundSettings = null;
    this.optimizeTransition = null;
  }

  // Theme
  _changeAllTheme() {
    if (this._sourceIds) {
      if (this._sourceIds.transitionDelayTimeout) {
        GLib.source_remove(this._sourceIds.transitionDelayTimeout);
        this._sourceIds.transitionDelayTimeout = 0;
      }
      if (this._sourceIds.changeIconsDelayTimeout) {
        GLib.source_remove(this._sourceIds.changeIconsDelayTimeout);
        this._sourceIds.changeIconsDelayTimeout = 0;
      }
      if (this._sourceIds.shellThemeDelayTimeout) {
        GLib.source_remove(this._sourceIds.shellThemeDelayTimeout);
        this._sourceIds.shellThemeDelayTimeout = 0;
      }
    }

    this.optimizeTransition.inProgress = true;

    const isDm = this.getDarkMode();

    if (this._darkModeMenuItem) {
      this._darkModeMenuItem.setToggleState(isDm);
    }

    this._animateIconTransition(isDm);

    this._changeGtk3Theme(isDm ? GTK3_THEME_DARK : GTK3_THEME_LIGHT);

    // Change shell theme with a 400ms delay to allow the 350ms icon transition to finish completely
    if (this._sourceIds.shellThemeDelayTimeout) {
      GLib.source_remove(this._sourceIds.shellThemeDelayTimeout);
      this._sourceIds.shellThemeDelayTimeout = 0;
    }
    this._sourceIds.shellThemeDelayTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 400, () => {
      this._changeShellTheme(isDm ? SHELL_THEME_DARK : SHELL_THEME_LIGHT);
      this._sourceIds.shellThemeDelayTimeout = 0;
      return GLib.SOURCE_REMOVE;
    });

    //I add delay here to avoid lag
    if (this._sourceIds.transitionDelayTimeout) {
      GLib.source_remove(this._sourceIds.transitionDelayTimeout);
      this._sourceIds.transitionDelayTimeout = 0;
    }
    this._sourceIds.transitionDelayTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
      if (OPTIMIZE_DARKLIGHT_SWITCH_TRANSITION) this.optimizeTransition.darkModeTransition?.run();
      this._sourceIds.transitionDelayTimeout = 0;
      return GLib.SOURCE_REMOVE;
    });

    if (this._sourceIds.changeIconsDelayTimeout) {
      GLib.source_remove(this._sourceIds.changeIconsDelayTimeout);
      this._sourceIds.changeIconsDelayTimeout = 0;
    }
    this._sourceIds.changeIconsDelayTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
      this._changeCursorTheme(isDm ? CURSOR_THEME_DARK : CURSOR_THEME_LIGHT);
      this._changeIconTheme(isDm ? ICON_THEME_DARK : ICON_THEME_LIGHT);
      this.optimizeTransition.inProgress = false;
      this._sourceIds.changeIconsDelayTimeout = 0;
      return GLib.SOURCE_REMOVE;
    });

    this._runCustomCommands(isDm);
    this._syncLockscreenWallpaper(isDm);
  }

  _runCustomCommands(isDm) {
    if (!this._settings.get_boolean("run-custom-commands"))
      return;

    const command = isDm
      ? this._settings.get_string("custom-command-dark")
      : this._settings.get_string("custom-command-light");

    if (!command || command.trim() === "")
      return;

    try {
      const proc = Gio.Subprocess.new(
        ['/bin/sh', '-c', command],
        Gio.SubprocessFlags.NONE
      );
      proc.init(null);
      proc.wait_async(null, (p, res) => {
        try {
          p.wait_finish(res);
        } catch (e) {
          console.error(`[DM Theme Changer Reborn] Custom command failed: ${e.message}`);
        }
      });
    } catch (e) {
      console.error(`[DM Theme Changer Reborn] Error spawning custom command: ${e.message}`);
    }
  }

  _syncLockscreenWallpaper(isDm) {
    if (!this._settings.get_boolean("sync-lockscreen-wallpaper"))
      return;

    let uri = "";
    if (this._settings.get_boolean("lockscreen-use-desktop-wallpaper")) {
      try {
        if (!this._backgroundSettings) {
          this._backgroundSettings = new Gio.Settings({
            schema: "org.gnome.desktop.background",
          });
        }
        uri = isDm
          ? this._backgroundSettings.get_string("picture-uri-dark")
          : this._backgroundSettings.get_string("picture-uri");
      } catch (e) {
        console.error(`[DM Theme Changer Reborn] Error reading desktop wallpaper keys: ${e.message}`);
      }
    } else {
      uri = isDm
        ? this._settings.get_string("lockscreen-wallpaper-dark")
        : this._settings.get_string("lockscreen-wallpaper-light");
    }

    if (!uri || uri.trim() === "")
      return;

    try {
      if (!this._screensaverSettings) {
        this._screensaverSettings = new Gio.Settings({
          schema: "org.gnome.desktop.screensaver",
        });
      }
      this._screensaverSettings.set_string("picture-uri", uri);
    } catch (e) {
      console.error(`[DM Theme Changer Reborn] Error syncing lockscreen wallpaper: ${e.message}`);
    }
  }

  _changeShellTheme(themeName) {
    if (this._currentShellTheme === themeName) {
      return;
    }
    this._currentShellTheme = themeName;

    let stylesheet = null;

    const stylesheetPaths = getDirs("themes").map(
      (dir) => `${dir}/${themeName}/gnome-shell/gnome-shell.css`
    );

    stylesheetPaths.push(...getModeThemeDirs().map((dir) => `${dir}/${themeName}.css`));

    stylesheet = stylesheetPaths.find((path) => {
      let file = Gio.file_new_for_path(path);
      return file.query_exists(null);
    });
    Main.setThemeStylesheet(stylesheet);
    Main.loadTheme();
  }

  _changeCursorTheme(themeName) {
    if (this._interfaceSettings && this._interfaceSettings.get_string("cursor-theme") !== themeName) {
      this._interfaceSettings.set_string("cursor-theme", themeName);
    }
  }

  _changeIconTheme(themeName) {
    if (this._interfaceSettings && this._interfaceSettings.get_string("icon-theme") !== themeName) {
      this._interfaceSettings.set_string("icon-theme", themeName);
    }
  }

  _changeGtk3Theme(themeName) {
    if (this._interfaceSettings && this._interfaceSettings.get_string("gtk-theme") !== themeName) {
      this._interfaceSettings.set_string("gtk-theme", themeName);
    }
  }

  // Interface Settings
  _onInterfaceSettingsChanged(_, key) {
    if (!this._sourceIds) return;

    if (key === "color-scheme") {
      this._changeAllTheme();
    }

    // Handle cases where the user changes the theme from external sources (e.g., GNOME Tweaks).
    // This prevents the theme from being reverted to the one set by this extension, ensuring external changes are respected.
    const themeSettings = {
      "cursor-theme": {
        light: "cursor-theme-light",
        dark: "cursor-theme-dark",
      },
      "icon-theme": {
        light: "icon-theme-light",
        dark: "icon-theme-dark",
      },
      "gtk-theme": {
        light: "gtk3-theme-light",
        dark: "gtk3-theme-dark",
      },
    };

    if (themeSettings[key]) {
      const isDm = this.getDarkMode();
      const themeName = this._interfaceSettings.get_value(key).deepUnpack();
      const settingKey = isDm ? themeSettings[key].dark : themeSettings[key].light;

      this._settings.set_string(settingKey, themeName);
      this._fetchAllSettings();
    }
  }

  // Also handle cases where the user changes the Shell Theme from user-theme extension,
  // which is also used by GNOME Tweaks.
  _handleExternalShellThemeChanged() {
    if (this._isUserThemeEnabled()) this._addUserThemeListener();

    // Add another listener to remove User Theme listener when user disable User Theme Extension.
    const ids = Main.extensionManager.connect(
      "extension-state-changed",
      this._onExtensionStateChanged.bind(this)
    );

    this._sourceIds.extensionStateChanged = ids;
  }

  _destroyExternalShellThemeHandler() {
    this._removeUserThemeListener();
    if (this._userThemeSettings) this._userThemeSettings = null;
  }

  _onExtensionStateChanged(_, extension) {
    if (!extension.uuid.includes("user-theme@")) return;

    if (extension.state !== 1) {
      // State is not 1 means disabled
      this._removeUserThemeListener();
    }

    if (extension.state === 1) {
      // State is 1 means enabled
      this._addUserThemeListener();
    }
  }

  _isUserThemeEnabled() {
    const uuid = Main.extensionManager.getUuids().find((ext) => ext.includes("user-theme@"));

    if (!uuid) return false;

    const state = Main.extensionManager.lookup(uuid).state;

    return state === 1;
  }

  getUserThemeSettings() {
    if (!this._userThemeSettings)
      this._userThemeSettings = new Gio.Settings({
        schema: "org.gnome.shell.extensions.user-theme",
      });

    return this._userThemeSettings;
  }

  _addUserThemeListener() {
    if (!this._sourceIds?.userThemeListener)
      this._sourceIds.userThemeListener = this.getUserThemeSettings().connect(
        "changed",
        this._onUserThemeChanged.bind(this)
      );
  }

  _removeUserThemeListener() {
    if (!this._sourceIds?.userThemeListener) return;
    if (this._userThemeSettings) {
      this._userThemeSettings.disconnect(this._sourceIds.userThemeListener);
    }
    this._sourceIds.userThemeListener = 0;
  }

  _onUserThemeChanged(_, key) {
    if (!this._sourceIds) return;

    const isDm = this.getDarkMode();

    const themeName = this.getUserThemeSettings().get_value(key).deepUnpack();

    this._settings.set_string(
      isDm ? "shell-theme-dark" : "shell-theme-light",
      themeName === "" ? "Adwaita" : themeName
    );

    this._fetchAllSettings();
  }

  // Extension Settings
  _onSettingsChanged(_, key) {
    if (!this._sourceIds) return;

    if (this._sourceIds?.SettingsWriteTimeout)
      GLib.Source.remove(this._sourceIds.SettingsWriteTimeout);
    this._settings.delay();

    this._sourceIds.SettingsWriteTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 400, () => {
      this._settings.apply();
      this._fetchAllSettings();
      const isDm = this.getDarkMode();

      if (key.startsWith("cursor"))
        this._changeCursorTheme(isDm ? CURSOR_THEME_DARK : CURSOR_THEME_LIGHT);

      if (key.startsWith("icon")) this._changeIconTheme(isDm ? ICON_THEME_DARK : ICON_THEME_LIGHT);

      if (key.startsWith("shell"))
        this._changeShellTheme(isDm ? SHELL_THEME_DARK : SHELL_THEME_LIGHT);

      if (key.startsWith("gtk3")) this._changeGtk3Theme(isDm ? GTK3_THEME_DARK : GTK3_THEME_LIGHT);

      if (key === "optimize-darklight-switch-transition")
        this.optimizeTransition.toggle(this._settings.get_boolean(key));

      if (key === "darkmode-toggle-clickdelay")
        this.optimizeTransition.setClickDelay(this._settings.get_int(key));

      if (key === "darklight-transition-duration")
        this.optimizeTransition.setTransitionDuration(this._settings.get_int(key));

      if (key === "show-indicator") {
        if (this._settings.get_boolean("show-indicator")) {
          this._createIndicator();
        } else {
          this._destroyIndicator();
        }
      }
      this._sourceIds.SettingsWriteTimeout = 0;
      return GLib.SOURCE_REMOVE;
    });
  }

  _firstTimeInstall() {
    const isDm = this.getDarkMode();

    const themeSettings = {
      "cursor-theme": {
        light: "cursor-theme-light",
        dark: "cursor-theme-dark",
      },
      "icon-theme": {
        light: "icon-theme-light",
        dark: "icon-theme-dark",
      },
      "gtk-theme": {
        light: "gtk3-theme-light",
        dark: "gtk3-theme-dark",
      },
    };

    for (const [key, value] of Object.entries(themeSettings)) {
      const themeName = this._interfaceSettings.get_string(key);
      this._settings.set_string(isDm ? value.dark : value.light, themeName);
    }

    if (this._isUserThemeEnabled()) {
      const themeName = this.getUserThemeSettings().get_string("name");
      this._settings.set_string(isDm ? "shell-theme-dark" : "shell-theme-light", themeName);
    }

    this._settings.set_boolean("first-time-install", false);
  }

  _fetchAllSettings() {
    CURSOR_THEME_LIGHT = this._settings.get_string("cursor-theme-light");
    ICON_THEME_LIGHT = this._settings.get_string("icon-theme-light");
    SHELL_THEME_LIGHT = this._settings.get_string("shell-theme-light");
    GTK3_THEME_LIGHT = this._settings.get_string("gtk3-theme-light");

    CURSOR_THEME_DARK = this._settings.get_string("cursor-theme-dark");
    ICON_THEME_DARK = this._settings.get_string("icon-theme-dark");
    SHELL_THEME_DARK = this._settings.get_string("shell-theme-dark");
    GTK3_THEME_DARK = this._settings.get_string("gtk3-theme-dark");

    OPTIMIZE_DARKLIGHT_SWITCH_TRANSITION = this._settings.get_boolean(
      "optimize-darklight-switch-transition"
    );
  }

  //Utils
  getDarkMode() {
    return this._interfaceSettings.get_string("color-scheme") === "prefer-dark";
  }

  _toggleDarkMode() {
    const isDm = this.getDarkMode();
    this._interfaceSettings.set_string(
      "color-scheme",
      isDm ? "default" : "prefer-dark"
    );
  }

  _createIndicator() {
    if (this._indicator) return;

    // Create indicator button in panel and prevent child clipping
    this._indicator = new PanelMenu.Button(0.5, this.metadata.name, false);
    this._indicator.clip_to_allocation = false;

    const isDm = this.getDarkMode();

    // Create container for overlapping icons with clipping disabled to allow outward arc movement
    this._iconContainer = new St.Widget({
      layout_manager: new Clutter.BinLayout(),
      clip_to_allocation: false,
    });

    const lightIconPath = this.dir.get_child("icons").get_child("weather-clear-symbolic.svg");
    this._lightIcon = new St.Icon({
      gicon: new Gio.FileIcon({ file: lightIconPath }),
      style_class: "system-status-icon",
    });
    this._lightIcon.x_align = Clutter.ActorAlign.CENTER;
    this._lightIcon.y_align = Clutter.ActorAlign.CENTER;

    const darkIconPath = this.dir.get_child("icons").get_child("weather-clear-night-symbolic.svg");
    this._darkIcon = new St.Icon({
      gicon: new Gio.FileIcon({ file: darkIconPath }),
      style_class: "system-status-icon",
    });
    this._darkIcon.x_align = Clutter.ActorAlign.CENTER;
    this._darkIcon.y_align = Clutter.ActorAlign.CENTER;

    // Wrap icons in St.Bin to shield them from system style/theme updates resetting their pivot points/rotations
    this._lightIconBin = new St.Bin({
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
      clip_to_allocation: false,
    });
    this._lightIconBin.add_child(this._lightIcon);
    this._lightIconBin.set_pivot_point(0.5, 2.5); // Set pivot below the icon for a beautiful circular arc!

    this._darkIconBin = new St.Bin({
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
      clip_to_allocation: false,
    });
    this._darkIconBin.add_child(this._darkIcon);
    this._darkIconBin.set_pivot_point(0.5, 2.5); // Set pivot below the icon for a beautiful circular arc!

    this._iconContainer.add_child(this._lightIconBin);
    this._iconContainer.add_child(this._darkIconBin);

    // Initial state based on current dark mode setting
    if (isDm) {
      this._lightIconBin.opacity = 0;
      this._lightIconBin.rotation_angle_z = -60;

      this._darkIconBin.opacity = 255;
      this._darkIconBin.rotation_angle_z = 0;
    } else {
      this._darkIconBin.opacity = 0;
      this._darkIconBin.rotation_angle_z = -60;

      this._lightIconBin.opacity = 255;
      this._lightIconBin.rotation_angle_z = 0;
    }

    this._indicator.add_child(this._iconContainer);

    // Add Dark Mode Toggle menu item
    this._darkModeMenuItem = new PopupMenu.PopupSwitchMenuItem(
      _("Dark Mode"),
      this.getDarkMode()
    );
    this._darkModeMenuItem.add_style_class_name("dm-theme-changer-menu-item");
    this._darkModeMenuItem.connect("toggled", (item, state) => {
      this._interfaceSettings.set_string(
        "color-scheme",
        state ? "prefer-dark" : "default"
      );
    });
    this._indicator.menu.addMenuItem(this._darkModeMenuItem);

    // Add separator
    this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // Add Preferences/Settings item
    const settingsMenuItem = new PopupMenu.PopupMenuItem(_("Settings"));
    settingsMenuItem.add_style_class_name("dm-theme-changer-menu-item");
    settingsMenuItem.connect("activate", () => {
      this.openPreferences();
    });
    this._indicator.menu.addMenuItem(settingsMenuItem);

    // Add indicator to the panel right status area
    Main.panel.addToStatusArea(this.uuid, this._indicator);
  }

  _animateIconTransition(isDm) {
    if (!this._lightIconBin || !this._darkIconBin) return;

    this._lightIconBin.remove_all_transitions();
    this._darkIconBin.remove_all_transitions();

    // Re-enforce correct pivot points in case they were reset by system theme/style updates
    this._lightIconBin.set_pivot_point(0.5, 2.5);
    this._darkIconBin.set_pivot_point(0.5, 2.5);

    const exitIcon = isDm ? this._lightIconBin : this._darkIconBin;
    const enterIcon = isDm ? this._darkIconBin : this._lightIconBin;

    // Reset translations to ensure clean rotation arc
    exitIcon.translation_x = 0;
    exitIcon.translation_y = 0;
    enterIcon.translation_x = 0;
    enterIcon.translation_y = 0;

    // 1. Exit Icon: Animate from center (0) to bottom-right (60 degrees) and fade out
    exitIcon.ease({
      opacity: 0,
      rotation_angle_z: 60,
      duration: 350,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
    });

    // 2. Enter Icon: Prepare at bottom-left (-60 degrees) and animate to center (0) and fade in
    enterIcon.rotation_angle_z = -60;
    enterIcon.opacity = 0;

    enterIcon.ease({
      opacity: 255,
      rotation_angle_z: 0,
      duration: 350,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
    });
  }

  _destroyIndicator() {
    if (this._darkModeMenuItem) {
      this._darkModeMenuItem.destroy();
      this._darkModeMenuItem = null;
    }
    if (this._lightIcon) {
      this._lightIcon.destroy();
      this._lightIcon = null;
    }
    if (this._darkIcon) {
      this._darkIcon.destroy();
      this._darkIcon = null;
    }
    if (this._lightIconBin) {
      this._lightIconBin.destroy();
      this._lightIconBin = null;
    }
    if (this._darkIconBin) {
      this._darkIconBin.destroy();
      this._darkIconBin = null;
    }
    if (this._iconContainer) {
      this._iconContainer.destroy();
      this._iconContainer = null;
    }
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
  }
}
