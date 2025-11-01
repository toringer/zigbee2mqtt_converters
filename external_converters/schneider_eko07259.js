import * as exposes from 'zigbee-herdsman-converters/lib/exposes';
import fz from 'zigbee-herdsman-converters/converters/fromZigbee';
import tz from 'zigbee-herdsman-converters/converters/toZigbee';

const e = exposes.presets;
const ea = exposes.access;

export default {
    zigbeeModel: ['EKO07259'],
    model: 'EKO07259',
    vendor: 'Schneider Electric',
    description: 'Smart thermostat',
    extend: [],
    fromZigbee: [fz.stelpro_thermostat, fz.metering, fz.schneider_pilot_mode, fz.wiser_device_info, fz.hvac_user_interface, {
        cluster: 0x0402, // Temperature Measurement cluster
        type: ['attributeReport', 'readResponse'],
        convert: (model, msg, publish, options, meta) => {
            const endpointId = msg.endpoint?.ID;
            const result = {};
            
            // Handle temperature from endpoint 2 (ambient) and endpoint 3 (external)
            if (endpointId === 2 || endpointId === 3) {
                const measuredValueAttrId = 0x0000; // MeasuredValue attribute
                const measuredValue = msg.data?.[measuredValueAttrId] ?? msg.data?.[String(measuredValueAttrId)] ?? msg.data?.['0x0000'];
                
                if (measuredValue !== undefined && measuredValue !== null && measuredValue !== 0x8000) {
                    const temperature = measuredValue / 100; // Convert from 0.01°C to °C
                    const key = endpointId === 2 ? 'temperature_2' : 'temperature_3';
                    result[key] = temperature;
                }
            }
            
            return Object.keys(result).length > 0 ? result : undefined;
        },
    }, {
        cluster: 'hvacUserInterfaceCfg',
        type: ['attributeReport', 'readResponse'],
        convert: (model, msg, publish, options, meta) => {
            const result = {};
            const inactiveBrightnessAttrId = 0xe001;
            const brightnessAttrId = 0xe000;
            
            if (msg.data && (msg.data.hasOwnProperty(inactiveBrightnessAttrId) || msg.data.hasOwnProperty(String(inactiveBrightnessAttrId)))) {
                const value = msg.data[inactiveBrightnessAttrId] ?? msg.data[String(inactiveBrightnessAttrId)];
                result.inactive_brightness = value;
            }
            
            if (msg.data && (msg.data.hasOwnProperty(brightnessAttrId) || msg.data.hasOwnProperty(String(brightnessAttrId)))) {
                const value = msg.data[brightnessAttrId] ?? msg.data[String(brightnessAttrId)];
                result.brightness = value;
            }
            
            return Object.keys(result).length > 0 ? result : undefined;
        },
    }],
    toZigbee: [
        {
            key: ['inactive_brightness'],
            convertSet: async (entity, key, value, meta) => {
                const inactiveBrightness = Number(value);
                if (inactiveBrightness < 0 || inactiveBrightness > 100) {
                    throw new Error(`Inactive brightness value must be between 0 and 100, got ${inactiveBrightness}`);
                }
                
                const endpoint = meta.device.getEndpoint(1);
                if (!endpoint) {
                    throw new Error('Endpoint 1 not found');
                }
                
                // Read current brightness to validate constraint: inactive_brightness <= brightness
                let currentBrightness = meta.state?.brightness;
                if (currentBrightness === undefined) {
                    try {
                        const response = await endpoint.read('hvacUserInterfaceCfg', [0xe000], { manufacturerCode: 0x105e });
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
                    await endpoint.write('hvacUserInterfaceCfg', payload, {
                        manufacturerCode: 0x105e,
                    });
                    return { state: { inactive_brightness: inactiveBrightness } };
                } catch (err) {
                    if (err.message && err.message.includes('INVALID_VALUE')) {
                        throw new Error(`Inactive brightness (${inactiveBrightness}) cannot exceed current brightness. Please increase brightness first or reduce inactive_brightness.`);
                    }
                    throw err;
                }
            },
            convertGet: async (entity, key, meta) => {
                const endpoint = meta.device.getEndpoint(1);
                if (!endpoint) {
                    throw new Error('Endpoint 1 not found');
                }
                await endpoint.read('hvacUserInterfaceCfg', [0xe001], { manufacturerCode: 0x105e });
            },
        },
        {
            key: ['brightness'],
            convertSet: async (entity, key, value, meta) => {
                const brightness = Number(value);
                if (brightness >= 1 && brightness <= 100) {
                    const attrId = 0xe000;
                    const endpoint = meta.device.getEndpoint(1);
                    if (!endpoint) {
                        throw new Error('Endpoint 1 not found');
                    }
                    const payload = {
                        [attrId]: {
                            value: brightness,
                            type: 0x20, // uint8
                        },
                    };
                    await endpoint.write('hvacUserInterfaceCfg', payload, {
                        manufacturerCode: 0x105e,
                    });
                    return { state: { brightness: brightness } };
                } else {
                    throw new Error(`Brightness value must be between 1 and 100, got ${brightness}`);
                }
            },
            convertGet: async (entity, key, meta) => {
                const endpoint = meta.device.getEndpoint(1);
                if (!endpoint) {
                    throw new Error('Endpoint 1 not found');
                }
                await endpoint.read('hvacUserInterfaceCfg', [0xe000], { manufacturerCode: 0x105e });
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
        e.numeric('brightness', ea.ALL)
            .withUnit('%')
            .withValueMin(1)
            .withValueMax(100)
            .withDescription('Display brightness when active (1-100)'),
        e.numeric('inactive_brightness', ea.ALL)
            .withUnit('%')
            .withValueMin(0)
            .withValueMax(100)
            .withDescription('Brightness level when inactive (0-100). Must be less than or equal to brightness.'),
        e.numeric('temperature_2', ea.STATE)
            .withUnit('°C')
            .withDescription('Ambient temperature from endpoint 2'),
        e.numeric('temperature_3', ea.STATE)
            .withUnit('°C')
            .withDescription('External temperature from endpoint 3'),
    ],
    meta: {
        multiEndpoint: true,
        defaultState: {
            inactive_brightness: 50,
            system_mode: 'heat',
            occupied_heating_setpoint: 20,
        },
    },
};

