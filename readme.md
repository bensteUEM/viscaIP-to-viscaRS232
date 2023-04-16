# viscaIP-to-viscaRS232

A Node.js server that listens to a specified UDP port and writes whatever data it receives to a local serial port.

Written so we could send VISCA via UDP to a local RS-232 serial adapter to control multiple Marshall CV620-BK4 cameras.
Responses from the camera are forwarded back to the controller where applicable. Visca-IP specific ACK packages are directly answered as the CV620 is not capable to answer Visca-IP specific requests.
Visca-IP can originate from multiple sources e.g. Companion App or VS-PTC-IP Controller.

Many thanks to Jospeh Adams who provided initial code and explanation!
https://github.com/josephdadams/udp-to-serial

Known to work with this adapter:
https://www.amazon.com/gp/product/B078X5H8H7/
DSD TECH SH-U10 USB to RS485 Converter with CP2102 Chip Compatible with Windows 7,8,10,Linux,Mac OS

Used
https://www.amazon.de/gp/product/B077PV1H97/ref=ppx_yo_dt_b_asin_title_o03_s00?ie=UTF8&psc=1 together with Marshal CV-620-Cable07 adapter to connect.

## Installing this software:

- Copy the code to a working directly on your computer. Make sure Node is installed.
- Run `npm install` to make sure all required modules are downloaded and installed.
- Run `node index.js` to start the server.

By default, the server will attempt to open:

- UDP Port `52381` and respective successive ports as defined in port_udp_count
- Serial Port `/dev/ttyUSB0` with a baud rate of `9600`
- Translates ViscaID relative to the UDP port
  - If camera 1 (81) is addressed the camera ID will be shifted according to the port offset (e.g. by default to 82 if for port 52382)
  - if Visca-ID 82 or higher the ID will remain unchanged
- Responses will always be from Visca-ID 1

This is configurable by modifying the `config.json` file.

If you're not sure what your serial port address is, on Linux, you can run this command:

`dmesg | grep tty`

It will filter the list to show you the serial ports.

## Special use

Update ViscaID using a Non-Visca custom command.
In order to map one Visca-IP endpoint dynamically to multiple ViscaIDs the ID can be overwritten with a special UDP request.
One use case could be using bitfocus companion in order to detect the preview input number from a video mixer (e.g. ATEM) and map camera control to this particular camera.

This can be achived by setting up a UDP module in Companion which sends messages to the same port as the Visca-IP module.
The message which should be be sent should be like this with XX at the 2nd last block to be replaced by ID 01-07
%01%20%00%06%00%00%00%00%80%01%00%04%XX%FF

Overwriting ViscaID is temporary only - default from config will be loaded on each restart

### Visca-IP explanation

ViscaIP Header
01 20 Visca Device Setting Command

Payload Lenght
00 06

Sequence Number
00 00 00 00

Visca RS232 Message for ID change is (XX to be replaced by 01-07)
usually 81 would indicate this change for cam 1, as this needs to change the module 80 is used as non standard value instead
80 01 00 04 XX FF
