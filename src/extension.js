import GLib from "gi://GLib";
import Gio from "gi://Gio";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { getDirs, getModeThemeDirs } from "./utils.js";

let CURSOR_THEME_LIGHT;
let ICON_THEME_LIGHT;
let SHELL_THEME_LIGHT;
let GTK3_THEME_LIGHT;

let CURSOR_THEME_DARK;
let ICON_THEME_DARK;
let SHELL_THEME_DARK;
let GTK3_THEME_DARK;

export default class DmThemeChanger extends Extension {
  enable() {
    //get all settings
    this._settings = this.getSettings();
    this._interfaceSettings = new Gio.Settings({
      schema: "org.gnome.desktop.interface",
    });

    this._fetchSettings();
    this._changeAllTheme();

    this._connectionIds = [];
    this._connectionIds.push(
      this._interfaceSettings.connect(
        "changed",
        this._onInterfaceChanged.bind(this)
      )
    );
    this._connectionIds.push(
      this._settings.connect("changed", this._onSettingsChanged.bind(this))
    );
  }

  disable() {
    this._settings = null;
    this._interfaceSettings = null;

    this._connectionIds.forEach((id) => GLib.source_remove(id));
    this._connectionIds = null;
  }

  //Theme
  _changeAllTheme() {
    const isDm = this.getDarkMode();
    this._changeCursorTheme(isDm ? CURSOR_THEME_DARK : CURSOR_THEME_LIGHT);
    this._changeIconTheme(isDm ? ICON_THEME_DARK : ICON_THEME_LIGHT);
    this._changeGtk3Theme(isDm ? GTK3_THEME_DARK : GTK3_THEME_LIGHT);
    this._changeShellTheme(isDm ? SHELL_THEME_DARK : SHELL_THEME_LIGHT);
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
    log(themeName);
    log(stylesheet);
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

  //Settings Interface
  _onInterfaceChanged(_, key) {
    if (key === "color-scheme") {
      this._changeAllTheme();
    }
  }

  //Settings
  _onSettingsChanged(_, key) {
    this._fetchSettings();
    const isDm = this.getDarkMode();

    if (key.startsWith("cursor")) {
      this._changeCursorTheme(isDm ? CURSOR_THEME_DARK : CURSOR_THEME_LIGHT);
    }

    if (key.startsWith("icon")) {
      this._changeIconTheme(isDm ? ICON_THEME_DARK : ICON_THEME_LIGHT);
    }

    if (key.startsWith("shell")) {
      this._changeShellTheme(isDm ? SHELL_THEME_DARK : SHELL_THEME_LIGHT);
    }

    if (key.startsWith("gtk3")) {
      this._changeGtk3Theme(isDm ? GTK3_THEME_DARK : GTK3_THEME_LIGHT);
    }
  }

  _fetchSettings() {
    CURSOR_THEME_LIGHT = this._settings.get_string("cursor-theme-light");
    ICON_THEME_LIGHT = this._settings.get_string("icon-theme-light");
    SHELL_THEME_LIGHT = this._settings.get_string("shell-theme-light");
    GTK3_THEME_LIGHT = this._settings.get_string("gtk3-theme-light");

    CURSOR_THEME_DARK = this._settings.get_string("cursor-theme-dark");
    ICON_THEME_DARK = this._settings.get_string("icon-theme-dark");
    SHELL_THEME_DARK = this._settings.get_string("shell-theme-dark");
    GTK3_THEME_DARK = this._settings.get_string("gtk3-theme-dark");
  }

  //Utils
  getDarkMode() {
    return this._interfaceSettings.get_string("color-scheme") === "prefer-dark";
  }
}
