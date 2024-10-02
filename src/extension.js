import GLib from "gi://GLib";
import Gio from "gi://Gio";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

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

export default class DmThemeChanger extends Extension {
  enable() {
    //get all settings
    this._settings = this.getSettings();
    this._interfaceSettings = new Gio.Settings({
      schema: "org.gnome.desktop.interface",
    });

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
  }

  disable() {
    this._destroyExternalShellThemeHandler();

    this.optimizeTransition.disable();

    Object.values(this._sourceIds).forEach((id) => {
      if (id) GLib.source_remove(id);
    });

    this._sourceIds = null;
    this._settings = null;
    this._interfaceSettings = null;
    this.optimizeTransition = null;
  }

  // Theme
  _changeAllTheme() {
    this.optimizeTransition.inProgress = true;

    const isDm = this.getDarkMode();

    this._changeGtk3Theme(isDm ? GTK3_THEME_DARK : GTK3_THEME_LIGHT);
    this._changeShellTheme(isDm ? SHELL_THEME_DARK : SHELL_THEME_LIGHT);

    //I add delay here to avoid lag
    this._sourceIds.transitionDelayTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
      if (OPTIMIZE_DARKLIGHT_SWITCH_TRANSITION) this.optimizeTransition.darkModeTransition?.run();
      this._sourceIds.transitionDelayTimeout = 0;
      return GLib.SOURCE_REMOVE;
    });

    this._sourceIds.changeIconsDelayTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
      this._changeCursorTheme(isDm ? CURSOR_THEME_DARK : CURSOR_THEME_LIGHT);
      this._changeIconTheme(isDm ? ICON_THEME_DARK : ICON_THEME_LIGHT);
      this.optimizeTransition.inProgress = false;
      this._sourceIds.changeIconsDelayTimeout = 0;
      return GLib.SOURCE_REMOVE;
    });
  }

  _changeShellTheme(themeName) {
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
    GLib.source_remove(this._sourceIds.userThemeListener);
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
}
