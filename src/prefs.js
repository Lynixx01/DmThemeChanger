import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Adw from "gi://Adw";
import Gtk from "gi://Gtk";

import { collectAllThemes } from "./utils.js";

import {
  ExtensionPreferences,
  gettext as _,
} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class DmThemeChangerPrefs extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    this._settings = this.getSettings();

    const generalPage = new Adw.PreferencesPage();
    window.add(generalPage);

    collectAllThemes().then((themes) => {
      this._themes = themes;

      generalPage.add(this._lightModeGroup());
      generalPage.add(this._darkModeGroup());
    });
  }

  _lightModeGroup() {
    const group = new Adw.PreferencesGroup({
      title: _("Light Mode"),
      description: _("Configure the theme settings for light mode."),
    });

    const cursorDropDown = buildDropDown({
      title: _("Cursor"),
      items: this._themes.cursor,
      selected: this._settings.get_string("cursor-theme-light"),
      bind: [this._settings, "cursor-theme-light"],
    });

    const iconsDropDown = buildDropDown({
      title: _("Icons"),
      items: this._themes.icons,
      selected: this._settings.get_string("icon-theme-light"),
      bind: [this._settings, "icon-theme-light"],
    });

    const shellDropDown = buildDropDown({
      title: _("Shell"),
      items: this._themes.shell,
      selected: this._settings.get_string("shell-theme-light"),
      bind: [this._settings, "shell-theme-light"],
    });

    const gtk3DropDown = buildDropDown({
      title: _("Legacy Applications"),
      items: this._themes.gtk3,
      selected: this._settings.get_string("gtk3-theme-light"),
      bind: [this._settings, "gtk3-theme-light"],
    });

    group.add(cursorDropDown);
    group.add(iconsDropDown);
    group.add(shellDropDown);
    group.add(gtk3DropDown);
    return group;
  }

  _darkModeGroup() {
    const group = new Adw.PreferencesGroup({
      title: _("Dark Mode"),
      description: _("Configure the theme settings for dark mode."),
    });

    const cursorDropDown = buildDropDown({
      title: _("Cursor"),
      items: this._themes.cursor,
      selected: this._settings.get_string("cursor-theme-dark"),
      bind: [this._settings, "cursor-theme-dark"],
    });

    const iconsDropDown = buildDropDown({
      title: _("Icons"),
      items: this._themes.icons,
      selected: this._settings.get_string("icon-theme-dark"),
      bind: [this._settings, "icon-theme-dark"],
    });

    const shellDropDown = buildDropDown({
      title: _("Shell"),
      items: this._themes.shell,
      selected: this._settings.get_string("shell-theme-dark"),
      bind: [this._settings, "shell-theme-dark"],
    });

    const gtk3DropDown = buildDropDown({
      title: _("Legacy Applications"),
      items: this._themes.gtk3,
      selected: this._settings.get_string("gtk3-theme-dark"),
      bind: [this._settings, "gtk3-theme-dark"],
    });

    group.add(cursorDropDown);
    group.add(iconsDropDown);
    group.add(shellDropDown);
    group.add(gtk3DropDown);
    return group;
  }
}

export const DropdownItems = GObject.registerClass(
  {
    Properties: {
      name: GObject.ParamSpec.string(
        "name",
        "name",
        "name",
        GObject.ParamFlags.READWRITE,
        null
      ),
      value: GObject.ParamSpec.string(
        "value",
        "value",
        "value",
        GObject.ParamFlags.READWRITE,
        null
      ),
    },
  },
  class DropdownItems extends GObject.Object {
    _init(name, value) {
      super._init({ name, value });
    }
  }
);

function buildDropDown(
  opts = {
    title: "Untitled drop down",
    subtitle: null,
    items: [],
    selected: null,
    bind: null,
  }
) {
  let liststore = new Gio.ListStore({ item_type: DropdownItems });
  for (const item of opts.items) {
    liststore.append(new DropdownItems(item.name, item.value));
  }

  let selected = null;
  for (let i = 0; i < liststore.get_n_items(); i++) {
    if (liststore.get_item(i).value === opts.selected) {
      selected = i;
      break;
    }
  }
  if (selected === null) selected = -1;

  let comboRow = new Adw.ComboRow({
    title: opts.title,
    subtitle: opts.subtitle || null,
    model: liststore,
    expression: new Gtk.PropertyExpression(DropdownItems, null, "name"),
    selected: selected,
  });

  if (opts.bind) {
    comboRow.connect("notify::selected", () => {
      opts.bind[0].set_string(opts.bind[1], comboRow.selectedItem.value);
    });
  }

  return comboRow;
}
