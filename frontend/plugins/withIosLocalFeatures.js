const { withEntitlementsPlist, withInfoPlist } = require("expo/config-plugins");

// Register first so these mods run after the shared notification, picker and speech plugins.
module.exports = function withIosLocalFeatures(config) {
  withEntitlementsPlist(config, (mod) => {
    // Scheduling local reminders needs no APNs entitlement or push credentials.
    delete mod.modResults["aps-environment"];
    return mod;
  });
  return withInfoPlist(config, (mod) => {
    delete mod.modResults.NSMicrophoneUsageDescription;
    delete mod.modResults.NSSpeechRecognitionUsageDescription;
    delete mod.modResults.GADDelayAppMeasurementInit;
    return mod;
  });
};
