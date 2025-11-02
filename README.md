# Zigbee2MQTT Device Converter - Schneider Electric EKO07259

Device converter for the **Schneider Electric EKO07259** smart thermostat, enabling integration with Zigbee2MQTT.

## Overview

This converter provides full support for the Schneider Electric EKO07259 smart thermostat, allowing it to be controlled and monitored through Zigbee2MQTT. The device supports temperature control, heating modes, display settings, and activity-based brightness management.

## Device Information

- **Model**: EKO07259
- **Vendor**: Schneider Electric
- **Type**: Smart thermostat
- **Zigbee Model**: EKO07259

## Features

### Climate Control
- Temperature setpoint control (0-40°C, 0.5°C increments)
- Local temperature monitoring
- System modes: `off`, `heat`
- Running states: `idle`, `heat`
- PI heating demand monitoring
- Occupied heating setpoint configuration

### Display & Interface
- **Brightness**: Active display brightness (1-100%)
- **Inactive Brightness**: Brightness level when device is idle (0-100%, must be ≤ active brightness)
- **Activity Timeout**: Time in seconds before device transitions to inactive state (5-3600 seconds, or disabled)
- **Temperature Display Mode**: Celsius or Fahrenheit
- **Keypad Lockout**: Enable/disable physical input on the device

### Additional Features
- Pilot mode control (`contactor` or `pilot`)
- Energy metering support
- Device information reporting
- HVAC user interface configuration

## Installation

1. Copy the `EKO07259.js` file to your Zigbee2MQTT device converter directory:
   ```
   /opt/zigbee2mqtt/data/devices/EKO07259.js
   ```
   Or your custom Zigbee2MQTT data directory.

2. Restart Zigbee2MQTT to load the new converter.

3. Pair your Schneider Electric EKO07259 thermostat with your Zigbee coordinator.

## Configuration

Upon pairing, the device will automatically configure:
- Binds to HVAC Thermostat cluster on endpoint 1
- Binds to Smart Energy Metering cluster on endpoint 2
- Enables reporting for PI heating demand and occupied heating setpoint
- Reads initial display configuration settings

## Usage

### Setting Temperature

Set the occupied heating setpoint:
```json
{
  "occupied_heating_setpoint": 22.5
}
```

### Controlling System Mode

Turn heating on:
```json
{
  "system_mode": "heat"
}
```

Turn heating off:
```json
{
  "system_mode": "off"
}
```

### Display Brightness

Set active brightness (1-100%):
```json
{
  "brightness": 75
}
```

Set inactive brightness (0-100%, must be ≤ brightness):
```json
{
  "inactive_brightness": 30
}
```

### Activity Timeout

Set timeout in seconds (5-3600):
```json
{
  "activity_timeout": 300
}
```

Disable timeout (always active):
```json
{
  "activity_timeout": null
}
```

### Keypad Lockout

Lock the keypad:
```json
{
  "keypad_lockout": "lock1"
}
```

Unlock the keypad:
```json
{
  "keypad_lockout": "unlock"
}
```

### Temperature Display Mode

Set to Celsius:
```json
{
  "temperature_display_mode": "celsius"
}
```

Set to Fahrenheit:
```json
{
  "temperature_display_mode": "fahrenheit"
}
```

### Pilot Mode

Set pilot mode:
```json
{
  "schneider_pilot_mode": "pilot"
}
```

Set contactor mode:
```json
{
  "schneider_pilot_mode": "contactor"
}
```

## Exposed Features

The converter exposes the following MQTT topics:

- `climate` - Main climate control (setpoint, local temperature, system mode, running state, PI heating demand)
- `brightness` - Display brightness when active (1-100%)
- `inactive_brightness` - Display brightness when inactive (0-100%)
- `activity_timeout` - Activity timeout in seconds (5-3600, or null for disabled)
- `keypad_lockout` - Keypad lock status
- `schneider_pilot_mode` - Pilot mode setting
- `temperature_display_mode` - Temperature display format

## Technical Details

### Zigbee Clusters Used

- **hvacThermostat** (endpoint 1) - Temperature control and monitoring
- **hvacUserInterfaceCfg** (endpoint 1) - Display and interface configuration
- **seMetering** (endpoint 2) - Energy metering

### Custom Attributes

The converter uses manufacturer-specific attributes in the `hvacUserInterfaceCfg` cluster:
- `0xe000` - Brightness (uint8)
- `0xe001` - Inactive Brightness (uint8)
- `0xe002` - Activity Timeout (uint16, 0xffff = disabled)

Manufacturer code: `0x105e`

### Constraints

- Inactive brightness must be less than or equal to active brightness
- Activity timeout must be between 5 and 3600 seconds, or null/disabled
- Brightness values must be between 1-100% (active) and 0-100% (inactive)

## Dependencies

This converter requires:
- `zigbee-herdsman-converters` - Zigbee converter library
- Zigbee2MQTT - MQTT bridge for Zigbee devices

## License

This converter is part of the Zigbee2MQTT project ecosystem.

## Contributing

If you encounter issues or have improvements, please contribute to the Zigbee2MQTT project or create an issue in the appropriate repository.

## Support

For Zigbee2MQTT support and documentation, visit:
- [Zigbee2MQTT Documentation](https://www.zigbee2mqtt.io/)
- [Zigbee2MQTT GitHub](https://github.com/Koenkk/zigbee2mqtt)

