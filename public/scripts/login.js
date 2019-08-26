const socket = io('/login');
socket.on('login', (id) => {
	const d = new Date();
	d.setHours(d.getHours()+9);
	document.cookie = `id=${id}; expires=${d}`;
	location.replace(location.origin);
});
new Vue({
	el: 'form.login',
	data: {
		name: ''
	},
	methods: {
		login: function() {
			let name = this.name;
			if(name.trim() !== '') {
				socket.emit('login', name);
			} else {
				return false
			}
		}
	}
});