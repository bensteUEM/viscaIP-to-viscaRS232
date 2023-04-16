const { SerialPort } = require('serialport')
const { DelimiterParser } = require('@serialport/parser-delimiter')

//udp-to-serial
const udp = require('dgram')
const fs = require('fs')

const configFile = 'config.json'

const config = {
	port_udp: 52381,
	port_udp_count: 2,
	port_serial: '/dev/ttyUSB0',
	baudRate: 9600,
}

let serialPort = null //variable for serial port reference
let sockets = [] //variable to store UDP socket for responding

//save last used address and port for response
let last_socket = null
let last_address = null
let last_port = null

function startup() {
	// runs the UDP and Serial connections
	loadFile()
	console.log('Loading config', config)

	//Open Serial Port
	console.log('Opening Serial Port: ' + config.port_serial)
	serialPort = new SerialPort(
		{
			path: config.port_serial,
			baudRate: config.baudRate,
		},
		function (err) {
			if (err) {
				console.log('Error opening serial port: ', err.message)
			}
		}
	)

	// Create Hex Parser and link to serialPort
	const parser = serialPort.pipe(new DelimiterParser({ delimiter: hexToBytes('ff'), includeDelimiter: true }))
	parser.on('data', viscaRS232ResponseParser)
	//console.log('Parser Created')

	//Open UDP Ports
	for (let i = 0; i < config.port_udp_count; i++) {
		sockets[i] = createMySocket(config.port_udp + i)
	}
}

function loadFile() {
	//loads settings on first load of app
	try {
		let rawdata = fs.readFileSync(configFile)
		let myJson = JSON.parse(rawdata)

		if (myJson.port_udp) {
			config.port_udp = myJson.port_udp
		}
		if (myJson.port_serial) {
			config.port_serial = myJson.port_serial
		}
		if (myJson.baudRate) {
			config.baudRate = myJson.baudRate
		}
		if (myJson.port_udp_count) {
			config.port_udp_count = myJson.port_udp_count
		}
	} catch (error) {
		console.log('Error parsing config file:')
		console.log(error)
	}
}

function createMySocket(port) {
	// Helper function creates udp4 socket and binds events
	let socket = udp.createSocket('udp4')
	socket.on('error', function (error) {
		console.log('Error: ' + error)
		socket.close()
	})

	socket.on('message', function (msg, rinfo) {
		//console.log('\nUDP Received %d bytes from %s:%d',msg.length, rinfo.address, rinfo.port, msg);
		//save address and port for reuse with replies
		last_socket = socket
		last_address = rinfo.address
		last_port = rinfo.port

		translate_visca_ip_to_cv620_visca_rs232(msg)
	})

	socket.on('listening', function () {
		let address = socket.address()
		console.log('Socket listening at: ' + address.address + ':' + address.port)
	})

	socket.on('close', function () {
		console.log('Socket is closed!')
	})

	socket.on('connect', function () {
		console.log('Socket is connected')
	})

	socket.bind(port, () => {
		const size = socket.ref()
		//console.log(size.eventNames());
	})

	return socket
}

function udp_respond(msg_text) {
	// Reference function to wrap udp responses to last known port and address considering Visca ID change and HEX conversion
	msg_text = translateViscaIdForIP(msg_text)
	const msg_hex = hexToBytes(msg_text)
	last_socket.send(msg_hex, last_port, last_address)
}

function viscaRS232ResponseParser(msg) {
	const msg_string = bytesToHexStrSpace(msg)
	console.log('Visca-RS232-received:: ', msg_string)

	// Define some Responses that should trigger special actions
	const rs232_syntax_error_text = '90 60 02 ff'
	const rs232_information_cam_powerInq_regex = /90 50 0[23] ff/

	if (compare_array(rs232_syntax_error_text, msg)) {
		console.log('\tVisca-Response: Syntax error')
	} else if (msg_string.match(rs232_information_cam_powerInq_regex) != null) {
		const relevant = msg_string.substring(6, 9)
		if (relevant == '02') {
			console.log('\tVisca-Response: CAM_PowerInq = On', msg[10])
		} else if (relevant == '03') {
			console.log('\tVisca-Response: CAM_PowerInq = Off(Standby)', msg[10])
		}
		translate_visca_rs232_to_visca_ip(msg)
	} else {
		translate_visca_rs232_to_visca_ip(msg)
	}
}

function addSpaceAndZerosToHexStr(str) {
	// Function to make sure hex String includes 0 and is formated in pairs split by space
	str = str.toString()
	str =
		str.length == 0
			? '00 '
			: str.length == 1
			? '0' + str + ' '
			: str.length == 2
			? str + ' '
			: str.substring(str.length - 2, str.length)
	return str
}

// Convert a hex string to a Uint8Array
function hexToBytes(hex) {
	let bytes
	//console.log('Trying Hex string -> Byte on',hex)
	for (bytes = [], c = 0; c < hex.length; c += 3) bytes.push(parseInt(hex.substr(c, 2), 16))
	let result = new Uint8Array(bytes)
	//console.log('result: ',result)
	return result
}

// Convert Bytes to Hex String
function bytesToHexStrSpace(bytes) {
	let result = ''
	//console.log('Trying Byte -> Hex string on',bytes)
	bytes = new Uint8Array(bytes)
	for (i in bytes) {
		//console.log(bytes[i])
		let str = bytes[i].toString(16)
		str = addSpaceAndZerosToHexStr(str)
		result += str
	}
	result = result.substring(0, result.length - 1)
	//console.log('result: ',result)
	return result
}

function compare_array(array1, array2) {
	let result = array1 == bytesToHexStrSpace(array2)
	//console.log('Comparing text\n',array1,' to \n', bytesToHexStrSpace(array2), result)
	return result
}
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function translateViscaIdForIP(text) {
	/* 
	Modifies the destination address of outgoing Visca-IP messages to the respective visca-rs232 ID from conifg
	Always shifts receiver back to 90 to mimic Visca-IP required Visca-ID 1
	*/
	const regex_to_camera = /8[1234567]/
	const regex_from_camera = /[9ABCDEFabcdef]0/
	let result = ''

	let identifier = text.substring(0, 2)
	//console.log('checking translation for ident:',identifier)
	if (identifier == '01') {
		//with Visca IP Payload call recursion with Visca Payload only
		result = text.substring(0, 24) + translateViscaIdForIP(text.substring(24, text.length))
	} else if (identifier.match(regex_to_camera)) {
		//(identifier == '81') // Visca which should be sent to camera
		//{
		//if (identifier == '81') // If ViscaID 1 map to Visca ID Matching 1+Offset from default udp port
		let socket_id = last_socket.address()['port'] - config.port_udp + 1
		identifier = parseInt(identifier, 16) + socket_id - 1
		identifier = identifier.toString(16)
		result = identifier + text.substring(2, text.length)
		/*	 }
		else // Visca ID 2-7 forwarded directly without change
			{
			console.log('regex_to_camera but not 81')
			result = text
			}*/
	} else if (identifier.match(regex_from_camera)) {
		// Visca returned from Camera
		// This is always set to camera ID 1 in order to match VS-PTC-IP expectation with port forwarding
		// Companion Software ignores respones therefore can safely get the same reply
		// WARNING - Any other controller which is able to address other Visca-IDs using Visca-IP needs changes here!

		identifier = '90'
		result = identifier + text.substring(2, text.length)
	} else {
		result = text
		console.log('Error - no change, not Visca-IP neither from or to Visca')
	}
	return result
}

function translate_visca_rs232_to_visca_ip(msg) {
	/* Function that translates rs232 messages back to Visca IP by adding payload and respective headers
	Also triggers conversion for visca ID mapping
	*/
	const payload_length = addSpaceAndZerosToHexStr(msg.length)

	msg = bytesToHexStrSpace(msg)
	msg = translateViscaIdForIP(msg)

	const response_ip_text = '01 11 00 ' + payload_length + '00 00 00 01 ' + msg
	console.log('\tForwardning from RS232 to Visca-IP as', response_ip_text)
	udp_respond(response_ip_text)
}

function translate_visca_ip_to_cv620_visca_rs232(msg) {
	//camera specific methos which selectively answers or forwards
	console.log('Visca-IP Message Processing for', last_address, ':', last_port, 'on:', msg)

	//define basic responsens and querys to check for
	const visca_ack_text = '90 41 FF'
	const visca_ack_ip_text = '01 11 00 03 00 00 00 01 ' + visca_ack_text

	const visca_complete_text = '90 51 FF'
	const visca_complete_ip_text = '01 11 00 03 00 00 00 01 ' + visca_complete_text

	//Control Command - Reset Sequence Number
	const visca_reset_sequence_number_ip_text = '02 00 00 01 00 00 00 00 01'
	const visca_reset_sequence_number_ip_response_text = '02 01 00 01 00 00 00 00 01' //Acknowledge Control Request

	//Tally Mode  5: (Power LED:Red     Standby:Red)
	const visca_tally_mode_regex = /(8[1234567] 01 7e 01 0a 01 0)[023567]( ff)/

	//Visca Inquiry: CAM_PowerInq
	//visca_CAMP_PowerInq_text = '81 09 04 00 ff'
	//visca_CAMP_PowerInq_ip_text = '01 10 00 05 00 00 00 01 '+visca_CAMP_PowerInq_text

	if (compare_array(visca_reset_sequence_number_ip_text, msg)) {
		//console.log('\tDetected Visca-IP Control Command - Reset Sequence Number')
		//console.log('\tDirect Reply with ACK Control Command because RS232 does not have this option:',
		//	visca_reset_sequence_number_ip_response_text)
		udp_respond(visca_reset_sequence_number_ip_response_text)
	} else if (bytesToHexStrSpace(msg).match(visca_tally_mode_regex) != null) {
		//special for CV620-bk4 - Does not have Tally but needs to confirm message
		console.log('\tDetected Visca-RS232 Command: Tally Mode X:')
		console.log('\tDirect Reply with ACK:', visca_ack_ip_text)
		udp_respond(visca_ack_ip_text)
		console.log('\tDirect Reply with COMPLETE:', visca_complete_ip_text)
		udp_respond(visca_complete_ip_text)
	} else {
		const visca_type = new Uint16Array(msg)[0]
		if (1 == visca_type) {
			let visca_text = bytesToHexStrSpace(new Uint16Array(msg).slice(8))
			visca_text = translateViscaIdForIP(visca_text)
			const visca_hex = hexToBytes(visca_text)
			serialPort.write(Buffer.from(visca_hex))
			console.log('\tVisca-RS232-sent: ', visca_text)
		} else if (2 == visca_type) {
			console.log('Control Message of Unknown Type', msg)
		} else {
		}
	}
}

startup()
