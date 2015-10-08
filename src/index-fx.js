"use strict";

import KintoBase from "./KintoBase";
import BaseAdapter from "./adapters/base";

export default function loadKinto(Components) {
  let Cu = Components.utils;

  let { EventEmitter } = Cu.import("resource://gre/modules/devtools/shared/event-emitter.js", {});

  let fetch = Cu.import("resource://gre/modules/CollectionsUtils.jsm");
  if (!fetch) {
    throw new Error("There was a problem loading fx-fetch");
  }

  // ensure fetch has loaded properly


  class KintoFX extends KintoBase {
    /**
    * Provides a public access to the base adapter classes. Users can create
    * a custom DB adapter by extending BaseAdapter.
    *
    * @type {Object}
    */
    static get adapters() {
      return {
        BaseAdapter: BaseAdapter,
      };
    }

    constructor(options={}) {
      let emitter = {};
      EventEmitter.decorate(emitter);

      const defaults = {
        events: emitter
      };

      let expandedOptions = Object.assign(defaults, options);
      super(expandedOptions);
    }
  }

  return KintoFX;
}
