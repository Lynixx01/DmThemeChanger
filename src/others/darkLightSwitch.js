import Mtk from "gi://Mtk";
import GObject from "gi://GObject";
import Clutter from "gi://Clutter";

import GLib from "gi://GLib";

import * as Main from "resource:///org/gnome/shell/ui/main.js";

let TRANSITION_DURATION = 1000; // ms
let CLICK_DELAY = 3000; // ms

const DarkModeTransition = GObject.registerClass(
  class DarkModeTransition extends Clutter.Actor {
    _init() {
      super._init({ visible: false });
    }

    vfunc_hide() {
      this.content = null;
      super.vfunc_hide();
    }

    cloneSceenAndDisplay() {
      // if (this.visible) return;

      Main.uiGroup.set_child_above_sibling(this, null);

      const rect = new Mtk.Rectangle({
        x: 0,

        y: 0,
        width: global.screen_width,
        height: global.screen_height,
      });
      const [, , , scale] = global.stage.get_capture_final_size(rect);
      this.content = global.stage.paint_to_content(rect, scale, Clutter.PaintFlag.NO_CURSORS);

      this.opacity = 255;
      this.show();
    }

    run(onComplete = () => {}) {
      this.remove_all_transitions();

      this.ease({
        opacity: 0,
        duration: TRANSITION_DURATION,
        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        onStopped: this.onStopped,
        onComplete,
      });
    }

    onStopped() {
      if (this?.opacity < 1) this.hide();
    }
  }
);

export class OptimizeTransition {
  constructor(settings) {
    this._settings = settings;

    this.setTransitionDuration(this._settings.get_int("darklight-transition-duration"));
    this.setClickDelay(this._settings.get_int("darkmode-toggle-clickdelay"));
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;

    this.darkModeTransition = new DarkModeTransition();

    Main.layoutManager.darkModeTransition = this.darkModeTransition;
    Main.layoutManager.uiGroup.add_child(this.darkModeTransition);

    this.darkModeTransition.add_constraint(
      new Clutter.BindConstraint({
        source: Main.layoutManager.uiGroup,
        coordinate: Clutter.BindCoordinate.ALL,
      })
    );

    this.darkModeToggle =
      Main.panel?.statusArea["quickSettings"]?._darkMode?.quickSettingsItems?.[0];

    if (this.darkModeToggle && typeof this.darkModeToggle._toggleMode === "function") {
      if (!this._originalToggleMode) this._originalToggleMode = this.darkModeToggle._toggleMode;

      this._patchDarkModeToggle();
    }
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;

    this._settings = null;

    if (this.darkModeTransition) {
      Main.layoutManager.uiGroup.remove_child(this.darkModeTransition);
      Main.layoutManager.darkModeTransition = null;
      this.darkModeTransition.destroy();
      this.darkModeTransition = null;
    }

    if (this.darkModeToggle && typeof this.darkModeToggle._toggleMode === "function")
      this.darkModeToggle._toggleMode = this._originalToggleMode;

    if (this._toggleTimeoutId) {
      GLib.source_remove(this._toggleTimeoutId);
      this._toggleTimeoutId = 0;
    }
  }

  toggle(boolean) {
    if (boolean) return this.enable();
    this.disable();
  }

  setClickDelay(ms) {
    CLICK_DELAY = ms;
  }

  setTransitionDuration(ms) {
    TRANSITION_DURATION = ms;
  }

  _patchDarkModeToggle() {
    // Main.layoutManager.screenTransition.run();

    let that = this;

    this.darkModeToggle._toggleMode = function () {
      // Handle when user click dark mode toggle multiple time
      if (this.secondClick || that.inProgress) return;

      this.secondClick = true;

      that._toggleTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, CLICK_DELAY, () => {
        this.secondClick = false;
        this._toggleTimeoutId = 0;
        return GLib.SOURCE_REMOVE;
      });

      that.darkModeTransition?.cloneSceenAndDisplay();
      this._settings.set_string("color-scheme", this.checked ? "default" : "prefer-dark");
    };
  }
}
