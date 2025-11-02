import * as exposes from 'zigbee-herdsman-converters/lib/exposes';
import fz from 'zigbee-herdsman-converters/converters/fromZigbee';
import tz from 'zigbee-herdsman-converters/converters/toZigbee';
import {bind, thermostatPIHeatingDemand, thermostatOccupiedHeatingSetpoint} from "zigbee-herdsman-converters/lib/reporting";

const e = exposes.presets;
const ea = exposes.access;

export default {
    zigbeeModel: ["EKO07259"],
    model: "EKO07259",
    vendor: "Schneider Electric",
    description: "Smart thermostat",
    fromZigbee: [
        fz.stelpro_thermostat,
        fz.metering,
        fz.schneider_pilot_mode,
        fz.wiser_device_info,
        fz.hvac_user_interface,
        {
            cluster: "hvacUserInterfaceCfg",
            type: ["attributeReport", "readResponse"],
            convert: (model, msg, publish, options, meta) => {
                const result = {};
                const brightnessAttrId = 0xe000;
                const inactiveBrightnessAttrId = 0xe001;
                const activityTimeoutAttrId = 0xe002;

                // Handle brightness (0xe000)
                if (msg.data && (msg.data.hasOwnProperty(brightnessAttrId) || msg.data.hasOwnProperty(String(brightnessAttrId)))) {
                    const value = msg.data[brightnessAttrId] ?? msg.data[String(brightnessAttrId)];
                    result.brightness = value;
                }

                // Handle inactive_brightness (0xe001)
                if (msg.data && (msg.data.hasOwnProperty(inactiveBrightnessAttrId) || msg.data.hasOwnProperty(String(inactiveBrightnessAttrId)))) {
                    const value = msg.data[inactiveBrightnessAttrId] ?? msg.data[String(inactiveBrightnessAttrId)];
                    result.inactive_brightness = value;
                }

                // Handle activity_timeout (0xe002)
                if (msg.data && (msg.data.hasOwnProperty(activityTimeoutAttrId) || msg.data.hasOwnProperty(String(activityTimeoutAttrId)))) {
                    const value = msg.data[activityTimeoutAttrId] ?? msg.data[String(activityTimeoutAttrId)];
                    // Handle null value (0xffff) meaning "no timeout"
                    if (value === 0xffff || value === 65535) {
                        result.activity_timeout = null;
                    } else {
                        result.activity_timeout = value;
                    }
                }

                return Object.keys(result).length > 0 ? result : undefined;
            },
        },
    ],
    toZigbee: [
        {
            key: ["brightness"],
            convertSet: async (entity, key, value, meta) => {
                const brightness = Number(value);
                if (brightness < 1 || brightness > 100) {
                    throw new Error(`Brightness value must be between 1 and 100, got ${brightness}`);
                }

                const endpoint = meta.device.getEndpoint(1);
                if (!endpoint) {
                    throw new Error("Endpoint 1 not found");
                }

                const attrId = 0xe000;
                const payload = {
                    [attrId]: {
                        value: brightness,
                        type: 0x20, // uint8
                    },
                };

                await endpoint.write("hvacUserInterfaceCfg", payload, {
                    manufacturerCode: 0x105e,
                });

                return { state: { brightness: brightness } };
            },
            convertGet: async (entity, key, meta) => {
                const endpoint = meta.device.getEndpoint(1);
                if (!endpoint) {
                    throw new Error("Endpoint 1 not found");
                }
                await endpoint.read("hvacUserInterfaceCfg", [0xe000], { manufacturerCode: 0x105e });
            },
        },
        {
            key: ["inactive_brightness"],
            convertSet: async (entity, key, value, meta) => {
                const inactiveBrightness = Number(value);
                if (inactiveBrightness < 0 || inactiveBrightness > 100) {
                    throw new Error(`Inactive brightness value must be between 0 and 100, got ${inactiveBrightness}`);
                }

                const endpoint = meta.device.getEndpoint(1);
                if (!endpoint) {
                    throw new Error("Endpoint 1 not found");
                }

                // Read current brightness to validate constraint: inactive_brightness <= brightness
                let currentBrightness = meta.state?.brightness;
                if (currentBrightness === undefined) {
                    try {
                        const response = await endpoint.read("hvacUserInterfaceCfg", [0xe000], { manufacturerCode: 0x105e });
                        currentBrightness = response?.[0xe000];
                    } catch (err) {
                        // If read fails, we'll let the device reject it with INVALID_VALUE
                        currentBrightness = null;
                    }
                }

                if (currentBrightness !== null && inactiveBrightness > currentBrightness) {
                    throw new Error(`Inactive brightness (${inactiveBrightness}) cannot exceed brightness (${currentBrightness}). Please set brightness first or reduce inactive_brightness.`);
                }

                const attrId = 0xe001;
                const payload = {
                    [attrId]: {
                        value: inactiveBrightness,
                        type: 0x20, // uint8
                    },
                };

                try {
                    await endpoint.write("hvacUserInterfaceCfg", payload, {
                        manufacturerCode: 0x105e,
                    });
                    return { state: { inactive_brightness: inactiveBrightness } };
                } catch (err) {
                    if (err.message && err.message.includes("INVALID_VALUE")) {
                        throw new Error(`Inactive brightness (${inactiveBrightness}) cannot exceed current brightness. Please increase brightness first or reduce inactive_brightness.`);
                    }
                    throw err;
                }
            },
            convertGet: async (entity, key, meta) => {
                const endpoint = meta.device.getEndpoint(1);
                if (!endpoint) {
                    throw new Error("Endpoint 1 not found");
                }
                await endpoint.read("hvacUserInterfaceCfg", [0xe001], { manufacturerCode: 0x105e });
            },
        },
        {
            key: ["activity_timeout"],
            convertSet: async (entity, key, value, meta) => {
                const endpoint = meta.device.getEndpoint(1);
                if (!endpoint) {
                    throw new Error("Endpoint 1 not found");
                }

                let timeoutValue;
                // Handle null/undefined for "no timeout" (0xffff)
                if (value === null || value === undefined || value === "disabled" || value === "none") {
                    timeoutValue = 0xffff;
                } else {
                    timeoutValue = Number(value);
                    // Validate range: 5 seconds to 3600 seconds (1 hour)
                    if (timeoutValue < 5 || timeoutValue > 3600) {
                        throw new Error(`Activity timeout value must be between 5 and 3600 seconds, or null/disabled for no timeout, got ${timeoutValue}`);
                    }
                }

                const attrId = 0xe002;
                const payload = {
                    [attrId]: {
                        value: timeoutValue,
                        type: 0x21, // uint16
                    },
                };

                await endpoint.write("hvacUserInterfaceCfg", payload, {
                    manufacturerCode: 0x105e,
                });

                // Return null for state if 0xffff was set, otherwise return the actual value
                return { state: { activity_timeout: timeoutValue === 0xffff ? null : timeoutValue } };
            },
            convertGet: async (entity, key, meta) => {
                const endpoint = meta.device.getEndpoint(1);
                if (!endpoint) {
                    throw new Error("Endpoint 1 not found");
                }
                await endpoint.read("hvacUserInterfaceCfg", [0xe002], { manufacturerCode: 0x105e });
            },
        },
        tz.thermostat_occupied_heating_setpoint,
        tz.thermostat_system_mode,
        tz.thermostat_running_state,
        tz.thermostat_local_temperature,
        tz.thermostat_control_sequence_of_operation,
        tz.schneider_pilot_mode,
        tz.schneider_thermostat_keypad_lockout,
        tz.thermostat_temperature_display_mode,
    ],
    exposes: [
        e.binary("keypad_lockout", ea.STATE_SET, "lock1", "unlock").withDescription("Enables/disables physical input on the device"),
        e.enum("schneider_pilot_mode", ea.ALL, ["contactor", "pilot"]).withDescription("Controls piloting mode"),
        e
            .enum("temperature_display_mode", ea.ALL, ["celsius", "fahrenheit"])
            .withDescription("The temperature format displayed on the thermostat screen"),
        e
            .climate()
            .withSetpoint("occupied_heating_setpoint", 0, 40, 0.5)
            .withLocalTemperature()
            .withSystemMode(["off", "heat"])
            .withRunningState(["idle", "heat"])
            .withPiHeatingDemand(),
        e.numeric("brightness", ea.ALL)
            .withUnit("%")
            .withValueMin(1)
            .withValueMax(100)
            .withDescription("Display brightness when active (1-100)"),
        e.numeric("inactive_brightness", ea.ALL)
            .withUnit("%")
            .withValueMin(0)
            .withValueMax(100)
            .withDescription("Brightness level when inactive (0-100). Must be less than or equal to brightness."),
        e.numeric("activity_timeout", ea.ALL)
            .withUnit("s")
            .withValueMin(5)
            .withValueMax(3600)
            .withDescription("Time in seconds since last user interaction before device is considered idle and inactive_brightness is used. Set to null/disabled for no timeout (UI always active)."),
    ],
    configure: async (device, coordinatorEndpoint, logger) => {
        const endpoint1 = device.getEndpoint(1);
        const endpoint2 = device.getEndpoint(2);
        await bind(endpoint1, coordinatorEndpoint, ["hvacThermostat"]);
        await thermostatPIHeatingDemand(endpoint1);
        await thermostatOccupiedHeatingSetpoint(endpoint1);
        await bind(endpoint2, coordinatorEndpoint, ["seMetering"]);
        await endpoint1.read("hvacUserInterfaceCfg", ["keypadLockout", "tempDisplayMode", 0xe000, 0xe001, 0xe002], { manufacturerCode: 0x105e });
    },
};
