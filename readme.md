# udp-to-serial
A Node.js server that listens to a specified UDP port and writes whatever data it receives to a local serial port.

Written so we could send VISCA via UDP to a local RS-232 serial adapter to control multiple Marshall CV620-BK4 cameras.
Responses from the camera are forwarded back to the controller where applicable. Visca-IP specific ACK packages are directly answered as the CV620 is not capable to answer Visca-IP specific requests.
Visca-IP can originate from multiple sources e.g. Companion App or VS-PTC-IP Controller.

Many thanks to Jospeh Adams who provided initial code and explanation!

Known to work with this adapter:
https://www.amazon.com/gp/product/B078X5H8H7/
DSD TECH SH-U10 USB to RS485 Converter with CP2102 Chip Compatible with Windows 7,8,10,Linux,Mac OS

Used 
https://www.amazon.de/gp/product/B077PV1H97/ref=ppx_yo_dt_b_asin_title_o03_s00?ie=UTF8&psc=1 together with Marshal CV-620-Cable07 adapter to connect.


## Installing this software:
* Copy the code to a working directly on your computer. Make sure Node is installed.
* Run `npm install` to make sure all required modules are downloaded and installed.
* Run `node index.js` to start the server.

By default, the server will attempt to open:
* UDP Port `52381`
* Serial Port `/dev/ttyUSB0` with a baud rate of `9600`
* Visca ID 1

This is configurable by modifying the `config.json` file.

If you're not sure what your serial port address is, on Linux, you can run this command:

`dmesg | grep tty`

It will filter the list to show you the serial ports.
