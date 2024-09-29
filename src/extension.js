import GLib from "gi://GLib";
import Gio from "gi://Gio";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { getDirs, getModeThemeDirs } from "./utils.js";
import { optimizeTransition } from "./others/darkLightSwitch.js";

let CURSOR_THEME_LIGHT;
let ICON_THEME_LIGHT;
let SHELL_THEME_LIGHT;
let GTK3_THEME_LIGHT;

let CURSOR_THEME_DARK;
let ICON_THEME_DARK;
let SHELL_THEME_DARK;
let GTK3_THEME_DARK;

let OPTIMIZE_DARKLIGHT_SWITCH_TRANSITION;

export default class DmThemeChanger extends Extension {
  enable() {
    //get all settings
    this._settings = this.getSettings();
    this._interfaceSettings = new Gio.Settings({
      schema: "org.gnome.desktop.interface",
    });

    const isFirstTimeInstall = this._settings.get_boolean("first-time-install");
    if (isFirstTimeInstall) this._firstTimeInstall();

    this._fetchAllSettings();
    this._changeAllTheme();

    this._connectionIds = [];
    this._connectionIds.push(
      this._interfaceSettings.connect(
        "changed",
        this._onInterfaceSettingsChanged.bind(this)
      )
    );
    this._connectionIds.push(
      this._settings.connect("changed", this._onSettingsChanged.bind(this))
    );

    this._handleExternalShellThemeChanged();

    // TWEAKS
    optimizeTransition.init(this._settings);
    if (this._settings.get_boolean("optimize-darklight-switch-transition")) {
      optimizeTransition.enable();
    }
  }

  disable() {
    this._connectionIds.forEach((id) => GLib.source_remove(id));
    this._connectionIds = null;

    this._settings = null;
    this._interfaceSettings = null;

    this._destroyExternalShellThemeHandler();
    optimizeTransition.disable();
  }

  // Theme
  _changeAllTheme() {
    optimizeTransition.inProgress = true;

    const isDm = this.getDarkMode();

    this._changeGtk3Theme(isDm ? GTK3_THEME_DARK : GTK3_THEME_LIGHT);
    this._changeShellTheme(isDm ? SHELL_THEME_DARK : SHELL_THEME_LIGHT);

    //I add delay here to avoid lag
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
      if (OPTIMIZE_DARKLIGHT_SWITCH_TRANSITION)
        optimizeTransition.darkModeTransition?.run();
      return GLib.SOURCE_REMOVE;
    });

    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
      this._changeCursorTheme(isDm ? CURSOR_THEME_DARK : CURSOR_THEME_LIGHT);
      this._changeIconTheme(isDm ? ICON_THEME_DARK : ICON_THEME_LIGHT);
      optimizeTransition.inProgress = false;
      return GLib.SOURCE_REMOVE;
    });
  }

  _changeShellTheme(themeName) {
    let stylesheet = null;

    const stylesheetPaths = getDirs("themes").map(
      (dir) => `${dir}/${themeName}/gnome-shell/gnome-shell.css`
    );

    stylesheetPaths.push(
      ...getModeThemeDirs().map((dir) => `${dir}/${themeName}.css`)
    );

    stylesheet = stylesheetPaths.find((path) => {
      let file = Gio.file_new_for_path(path);
      return file.query_exists(null);
    });
    Main.setThemeStylesheet(stylesheet);
    Main.loadTheme();
  }

  _changeCursorTheme(themeName) {
    this._interfaceSettings.set_string("cursor-theme", themeName);
  }

  _changeIconTheme(themeName) {
    this._interfaceSettings.set_string("icon-theme", themeName);
  }

  _changeGtk3Theme(themeName) {
    this._interfaceSettings.set_string("gtk-theme", themeName);
  }

  // Interface Settings
  _onInterfaceSettingsChanged(_, key) {
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
      const settingKey = isDm
        ? themeSettings[key].dark
        : themeSettings[key].light;

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

    this._connectionIds.push(ids);
  }

  _destroyExternalShellThemeHandler() {
    this._removeUserThemeListener();
    if (this._userThemeSettings) this._userThemeSettings = null;
  }

  _onExtensionStateChanged(_, extension) {
    if (!extension.uuid.includes("user-theme@")) return;

    if (extension.state !== 1) {
      this._removeUserThemeListener();
    }

    if (extension.state === 1) {
      this._addUserThemeListener();
    }
  }

  _isUserThemeEnabled() {
    const uuid = Main.extensionManager
      .getUuids()
      .find((ext) => ext.includes("user-theme@"));

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
    if (!this._userThemeListenerId)
      this._userThemeListenerId = this.getUserThemeSettings().connect(
        "changed",
        this._onUserThemeChanged.bind(this)
      );
  }

  _removeUserThemeListener() {
    if (!this._userThemeListenerId) return;
    GLib.source_remove(this._userThemeListenerId);
    this._userThemeListenerId = null;
  }

  _onUserThemeChanged(_, key) {
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
    if (this._writeTimeoutId) GLib.Source.remove(this._writeTimeoutId);
    this._settings.delay();

    this._writeTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 400, () => {
      this._settings.apply();
      this._fetchAllSettings();
      const isDm = this.getDarkMode();

      if (key.startsWith("cursor"))
        this._changeCursorTheme(isDm ? CURSOR_THEME_DARK : CURSOR_THEME_LIGHT);

      if (key.startsWith("icon"))
        this._changeIconTheme(isDm ? ICON_THEME_DARK : ICON_THEME_LIGHT);

      if (key.startsWith("shell"))
        this._changeShellTheme(isDm ? SHELL_THEME_DARK : SHELL_THEME_LIGHT);

      if (key.startsWith("gtk3"))
        this._changeGtk3Theme(isDm ? GTK3_THEME_DARK : GTK3_THEME_LIGHT);

      if (key === "optimize-darklight-switch-transition")
        optimizeTransition.toggle(this._settings.get_boolean(key));

      if (key === "darkmode-toggle-clickdelay")
        optimizeTransition.setClickDelay(this._settings.get_int(key));

      if (key === "darklight-transition-duration")
        optimizeTransition.setTransitionDuration(this._settings.get_int(key));
      this._writeTimeoutId = 0;
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
      this._settings.set_string(
        isDm ? "shell-theme-dark" : "shell-theme-light",
        themeName
      );
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
    return Main.getStyleVariant() === "dark";
  }
}
