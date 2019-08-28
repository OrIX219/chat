const socket = io();
socket.emit('auth');
socket.on('auth', function(auth) {
	if(auth) {
		Vue.component('message', {
		props: ['msg', 'sys'],
		template: `<li v-if="sys" class="sysmsg"><img src="/sysImgs/MrDestructoid.png" alt="⟫"/> {{msg.text}} <img src="/sysImgs/MrDestructoid.png" alt="⟪" /></li>
		<li v-else><u><font color="lightslategrey">{{msg.name}}</font></u>:<br/><div v-if="msg.text">{{msg.text}}<br/></div><pic v-if="msg.imgs" v-for="img in msg.imgs" :img=img></pic></li>`
		});
		Vue.component('pic', {
			props: ['img'],
			template: `<img :src="img"/>`
		});
		Vue.component('user', {
			props: ['user'],
			template: `<li>{{user}}</li>`
		});
		Vue.component('room', {
			props: ['room'],
			template: `<li><span v-if="room !== 'Main'" @click="removeRoom(room)">&#10006</span>{{room}}</li>`,
			methods: {
				removeRoom: function(room) {
					socket.emit('remove room', room);
				}
			}
		});
		const sidebar = new Vue({
			el: '#sidebar',
			data: {
				currentRoom: '',
				rooms: [],
				usrs: [],
			},
			methods: {
				addUser: function(user) {
					this.usrs.push(user);
				},
				removeUser: function(user) {
					this.usrs.splice(this.usrs.indexOf(user), 1);
				},
				addRoom: function(room) {
					this.rooms.push(room);
				},
				createRoom: async function() {
					opts.showCN = false;
					opts.room = ''
					await opts.$nextTick()
					opts.showCR = !opts.showCR;
				},
				removeRoom: function(room) {
					this.rooms.splice(this.rooms.indexOf(room), 1);
				},
				changeRoom: function(room) {
					if(sidebar.currentRoom === room) {
						return false;
					}
					document.getElementById('loading').style.display = 'block';
					socket.emit('change room', room);
					this.usrs = [];
					messages.msgs = [];
				},
				changeName: async function() {
					opts.showCR = false;
					opts.name = ''
					await opts.$nextTick()
					opts.showCN = !opts.showCN;
				}
			}
		});
		const messages = new Vue({
			el: '#messages',
			data: {
				msgs: []
			},
			methods: {
				scrollToEnd: function() {
					var m = document.querySelector('#messages');
					m.scrollTop = m.scrollHeight;
				},
				addMsg: async function(data) {
					switch(data.type) {
						case 'message':
							this.msgs.push({text: data.text, imgs: data.imgs, name: data.name, sys: false});
							break;
						case 'connect': 
							this.msgs.push({text: `${data.name} has connected`, sys: true});
							break;
						case 'disconnect':
							this.msgs.push({text: `${data.name} has disconnected`, sys: true});
							break;
						case 'nameChange':
							this.msgs.push({text: `${data.name} changed his name to ${data.nname}`, sys: true});
							break;
						case 'roomCreation':
							this.msgs.push({text: `${data.name} has created new room "${data.room}"`, sys: true});
							break;
						case 'roomRemoval':
							this.msgs.push({text: `${data.name} has removed room "${data.room}"`, sys: true});
							break;
					}
					await this.$nextTick();
					this.scrollToEnd();
				}
			}
		});
		const input = new Vue({
			el: 'form.chat',
			data: {
				text: '',
				files: []
			},
			methods: {
				sendMsg: async function() {
					this.$refs.msg.focus();
					if(this.text.trim() === '' && this.files.length === 0) {
						return false;
					} else {
						let files = [];
						for(let i = 0; i < this.files.length; i++) {
							files.push(this.files[i].name);
						}
						socket.emit('send msg', this.text, files);
						this.text = "";
						this.files.splice(0, this.files.length);
					}
				},
				submitFiles: function() {
					if(this.files.length === 0) {
						return;
					}
					const formData = new FormData();
					for(let i = 0; i < this.files.length; i++) {
						let file = this.files[i];
						if(file.size > 1048576) {
							continue;
						}
						formData.append(`file${i}`, file);
					}
					axios.post('/sendImg',
						formData,
						{
							headers: {
								'Content-Type': 'multipart/form-data' 
							}
						})
						.then(function() {
							console.log('upload success');
						})
						.catch(function() {
							console.log('upload failed');
						});
				},
				handleImgUpload: function(e) {
					let files = this.$refs.files.files;
					for(let i = 0; i < files.length; i++) {
						if(files[i].size > 1048576) {
							continue;
						}
						this.files.push(files[i]);
					}
					this.submitFiles();
					e.target.value = '';
					this.$refs.msg.focus();
				},
				removeFile: function(key) {
					this.files.splice(key, 1);
				}
			}
		});
		const opts = new Vue({
			el: '#opts',
			data: {
				room: '',
				name: '',
				showCR: false,
				showCN: false,
				rExists: false,
				nExists: false
			},
			methods: {
				close: async function() {
					this.room = '';
					this.name = '';
					await this.$nextTick();
					this.showCR = false;
					this.showCN = false;
				},
				createRoom: function() {
					let room = this.room;
					socket.emit('create room', room);
					this.room = ''
					this.close();
				},
				changeName: function() {
					let name = this.name;
					socket.emit('change name', name);
					this.name = ''
					this.close();
				}
			},
			watch: {
				room: function(nr) {
					if(sidebar.rooms.includes(nr)) {
						this.rExists = true;
					} else {
						this.rExists = false;
					}
				},
				showCR: function(n) {
					if(n) {
						this.$nextTick(() => {this.$refs.roomName.focus()});
					}
				},
				name: function(nn) {
					if(sidebar.usrs.includes(nn)) {
						this.nExists = true;
					} else {
						this.nExists = false;
					}
				},
				showCN: function(n) {
					if(n) {
						this.$nextTick(() => {this.$refs.newName.focus()});
					}
				}
			}
		});
		socket.on('send msg', function(data) {
			messages.addMsg(data);
		});
		socket.on('create room', (room, name) => {
			messages.addMsg({type: 'roomCreation', room: room, name: name});
			sidebar.addRoom(room);
		});
		socket.on('remove room', (room, name) => {
			messages.addMsg({type: 'roomRemoval', room: room, name: name});
			sidebar.removeRoom(room);
		});
		socket.on('change name', (nname, name) => {
			messages.addMsg({type: 'nameChange', name: name, nname: nname});
			sidebar.$set(sidebar.usrs, sidebar.usrs.indexOf(name), nname);
		});
		socket.on('conn', name => {
			messages.addMsg({name: name, type: 'connect'});
			sidebar.addUser(name);
		});
		socket.on('disconn', name => {
			messages.addMsg({name: name, type: 'disconnect'});
			sidebar.removeUser(name);
		});
		socket.on('get data', async (rooms, currentRoom, msgs, name, users) => {
			sidebar.currentRoom = currentRoom;
			sidebar.rooms = rooms;
			sidebar.name = name;
			sidebar.usrs = users;
			msgs.forEach(msg => {
				messages.addMsg(msg);
			});
			await sidebar.$nextTick();
			await messages.$nextTick();
			document.getElementById('loading').style.display = 'none';
		});
	} else {
		location.replace(`${location}login.html`);
	}
});