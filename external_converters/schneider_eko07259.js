import * as m from 'zigbee-herdsman-converters/lib/modernExtend';
import * as exposes from 'zigbee-herdsman-converters/lib/exposes';
import fz from 'zigbee-herdsman-converters/converters/fromZigbee';
import tz from 'zigbee-herdsman-converters/converters/toZigbee';

const e = exposes.presets;
const ea = exposes.access;

export default {
    zigbeeModel: ['EKO07259'],
    model: 'EKO07259',
    vendor: 'Schneider Electric',
    description: 'Automatically generated definition',
    extend: [
        m.deviceEndpoints({"endpoints":{"1":1,"2":2,"3":3,"5":5}}), 
        m.temperature({"endpointNames":["2","3"]}), 
        m.electricityMeter({"cluster":"metering"}),
    ],
    fromZigbee: [
        fz.thermostat,
        {
            cluster: 'hvacUserInterfaceCfg',
            type: ['attributeReport', 'readResponse'],
            convert: (model, msg, publish, options, meta) => {
                const attrId = 0xe001;
                if (msg.data && (msg.data.hasOwnProperty(attrId) || msg.data.hasOwnProperty(String(attrId)))) {
                    const value = msg.data[attrId] ?? msg.data[String(attrId)];
                    return {inactive_brightness: value};
                }
            },
        },
    ],
    toZigbee: [
        {
            key: ['inactive_brightness'],
            convertSet: async (entity, key, value, meta) => {
                const brightness = Number(value);
                if (brightness >= 0 && brightness <= 100) {
                    const attrId = 0xe001;
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
                    return {state: {inactive_brightness: brightness}};
                } else {
                    throw new Error(`Inactive brightness value must be between 0 and 100, got ${brightness}`);
                }
            },
            convertGet: async (entity, key, meta) => {
                const endpoint = meta.device.getEndpoint(1);
                if (!endpoint) {
                    throw new Error('Endpoint 1 not found');
                }
                await endpoint.read('hvacUserInterfaceCfg', [0xe001], {manufacturerCode: 0x105e});
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
        e.numeric('inactive_brightness', ea.ALL)
            .withUnit('%')
            .withValueMin(0)
            .withValueMax(100)
            .withDescription('Brightness level when inactive (0-100)'),
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

