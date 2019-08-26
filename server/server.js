const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cookieParser = require('socket.io-cookie-parser');
const busboy = require('connect-busboy');
const fs = require('fs-extra');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const login = io.of('/login');
const chat = io.of('/');

app.use(express.static('../public'));
chat.use(cookieParser());
server.listen(3000, () => {
	console.log(`Server has been started`);
});
let id = 1;
io.engine.generateId = (req) => {
	return 'id' + id++;
}

const bd = {
	users: new Map(),
	login: function(name, id) {
		this.users.set(id, {name: name, rooms: []});
	},
	changeName: function(nname, id) {
		this.users.set(id, {name: nname, rooms: this.users.get(id).rooms});
	}
}

class Room {
	constructor(name) {
		this.name = name;
		this.users = [];
		this.msgs = [];
	}
	addUser(user, currentRoom) {
		this.users.push(user);
		chat.to(currentRoom.name).emit('conn', user);
		this.msgs.push({name: user, type: 'connect'});
	}
	removeUser(user, currentRoom) {
		this.users.splice(this.users.indexOf(user), 1);
		chat.to(currentRoom.name).emit('disconn', user);
		this.msgs.push({name: user, type: 'disconnect'});
	}
	addMsg(msg, currentRoom) {
		this.msgs.push(msg);
		chat.to(currentRoom.name).emit('send msg', msg);
	}
	static createRoom(room) {
		Room.rooms.set(room, new Room(room));
	};
	static removeRoom(room) {
		Room.rooms.delete(room);
	}
}
Room.rooms = new Map();
Room.createRoom('Main');

chat.on('connection', (socket) => {
	socket.on('auth', () => {
		let id = socket.request.cookies.id;
		if(id && bd.users.get(id) !== undefined) {
			socket.join('Main');
			chat.to(socket.id).emit('auth', true);
			let currentRoom = Room.rooms.get('Main');
			let name = bd.users.get(id).name;
			chat.to(socket.id).emit('get data', Array.from(Room.rooms.keys()), currentRoom.name, currentRoom.msgs, name, currentRoom.users);
			currentRoom.addUser(name, currentRoom);
			console.log(`${id} connected as ${name} to ${currentRoom.name}`);
			console.log(`Online at ${currentRoom.name} now: ${currentRoom.users}`);
			socket.on('send msg', (text, imgs) => {
				text = text.trimRight().trimLeft();
				if(text.trim() !== '' && imgs.length !== 0) {
					let pics = imgs.map(i => {return '/imgs/' + i});
					currentRoom.addMsg({text: text, name: name, imgs: pics, type: 'message'}, currentRoom);
				} else if(text.trim() !== '' && imgs.length === 0) {
					currentRoom.addMsg({text: text, name: name, type: 'message'}, currentRoom);
				} else if(text.trim() === '' && imgs.length !== 0) {
					let pics = imgs.map(i => {return '/imgs/' + i});
					currentRoom.addMsg({name: name, imgs: pics, type: 'message'}, currentRoom);
				} else {
					return false;
				}
			});
			socket.on('create room', room => {
				if(room === '') {
					return;
				}
				console.log(`${name} has created new room: \"${room}\"`);
				currentRoom.msgs.push({type: 'roomCreation', room: room, name: name});
				Room.createRoom(room);
				let rooms = bd.users.get(id).rooms;
				rooms.push(room);
				bd.users.set(id, {name: bd.users.get(id).name, rooms: rooms});
				chat.emit('create room', room, name);
				console.log('Rooms: ', Array.from(Room.rooms.keys()));
				console.log(`${bd.users.get(id).name} owns: ${bd.users.get(id).rooms}`);
			});
			socket.on('remove room', room => {
				if(!bd.users.get(id).rooms.includes(room)) {
					return;
				}
				console.log(`${name} removed room: ${room}`);
				currentRoom.msgs.push({type: 'roomRemoval', room: room, name: name});
				Room.removeRoom(room);
				chat.emit('remove room', room, name);
				console.log('Rooms: ', Array.from(Room.rooms.keys()));
			});
			socket.on('change name', nname => {
				if(name === '') {
					return;
				}
				console.log(`${name} has changed his name to ${nname}`);
				currentRoom.msgs.push({type: 'nameChange', name: name, nname: nname});
				bd.changeName(nname, id);
				currentRoom.users[currentRoom.users.indexOf(name)] = nname;
				chat.emit('change name', nname, name);
				name = nname;
			});
			socket.on('change room', room => {
				console.log(`${name} has moved from ${currentRoom.name} to ${room}`);
				socket.leave(currentRoom.name);
				currentRoom.removeUser(name, currentRoom);
				currentRoom = Room.rooms.get(room);
				socket.join(currentRoom.name);
				chat.to(socket.id).emit('get data', Array.from(Room.rooms.keys()), currentRoom.name, currentRoom.msgs, name, currentRoom.users);
				currentRoom.addUser(name, currentRoom);
			});
			socket.on('disconnect', () => {
				currentRoom.removeUser(name, currentRoom);
				console.log(`${name} disconnected`);
			});
		} else {
			chat.to(socket.id).emit('auth', false);
		}
	});
});

login.on('connection', (socket) => {
	console.log('User connected');
	socket.on('login', (name) => {
		bd.login(name, socket.id.slice(7));
		socket.emit('login', socket.id.slice(7));
	});
});

app.use(busboy());
app.route('/sendImg').post((req, res) => {
	req.pipe(req.busboy);
	req.busboy.on('file', function(fieldname, file, filename) {
		console.log('Uploading ' + filename);
		let fstream = fs.createWriteStream(`../public/imgs/${filename}`);
		file.pipe(fstream);
		fstream.on('close', function () {    
            console.log("Upload finished of " + filename);
            res.end();
        });
	});
});