function split(string,token) {
	let arr = string.split(token);
	if (arr[arr.length-1].replace(/(\r\n|\r|\n)*/g,'') == '') arr.pop();
	return arr;
}

function parseTable(str) {
	let strArr = split(str,',');
	let numArr = [];
	for (let i = 0; i < strArr.length; i++) {
		numArr[i] = Number(strArr[i]);
	}
	return numArr;
}

class AnimInfo {
	constructor(duration, start) {
		this.duration = duration;
		this.start = start;
	}
}

class FirstPartData {
	constructor(yawD,yawS, pitchD,pitchS, rollD,rollS, xD,xS, yD,yS, zD,zS) {
		this.yaw = new AnimInfo(yawD,yawS);
		this.pitch = new AnimInfo(pitchD,pitchS);
		this.roll = new AnimInfo(rollD,rollS);
		this.x = new AnimInfo(xD,xS);
		this.y = new AnimInfo(yD,yS);
		this.z = new AnimInfo(zD,zS);
	}
}

class PartData {
	constructor(yawD,yawS, pitchD,pitchS, rollD,rollS) {
		this.yaw = new AnimInfo(yawD,yawS);
		this.pitch = new AnimInfo(pitchD,pitchS);
		this.roll = new AnimInfo(rollD,rollS);
	}
}

class Animation {
	constructor(parts, indices, values) {
		this.parts = parts;
		this.indices = indices;
		this.values = values;
	}
}

function parseIndices(indices) {
	let parts = [];
	let i = indices;
	parts.push(new FirstPartData(i[0],i[1],i[2],i[3],i[4],i[5],i[6],i[7],i[8],i[9],i[10],i[11]));
	for (let j = 12; j < indices.length; j += 6) {
		parts.push(new PartData(i[j+0],i[j+1],i[j+2],i[j+3],i[j+4],i[j+5]));
	}
	return parts;
}

function parse(code,part) {
	let regex = /.*{([\S\s]*?)};/gm;
	let tablesString = code.replace(regex,'$1|');
	let tables = split(tablesString,'|');
	
	let indices;
	let values;
	if (!part) {
		indices = parseTable(tables[1]);
		values = parseTable(tables[2]);
	} else {
		indices = parseTable(tables[2]);
		values = parseTable(tables[3]);
	}
	
	let parts = parseIndices(indices);
	return new Animation(parts, indices, values);
}

class Property {
	constructor(name,partIndex,isAngle=false) {
		this.name = name;
		this.partIndex = partIndex;
		this.isAngle = isAngle;
		this.value = 0;
		this.currentFrame = 0;
		this.duration = 0;
		this.start = 0;
		this.animation = null;
	}
	setAnimation(animation) {
		this.animation = animation;
		let prop = this.animation.parts[this.partIndex][this.name];
		this.start = prop.start;
		this.duration = prop.duration;
		this.value = this.animation.values[this.start];
	}
	advanceFrame() {
		this.currentFrame++;
		if (this.currentFrame >= this.duration) this.currentFrame = 0;
		this.setFrame(this.currentFrame);
	}
	setFrame(index) {
		this.value = this.animation.values[this.animation.parts[this.partIndex][this.name].start + index];
		if (this.isAngle) this.value = shortIntToRadian(this.value);
	}
}

function shortIntToRadian(value) {
	return value === 0 ? value : Math.PI/32768 * value;
}

class Part {
	constructor(index,isFirstPart=false) {
		this.index = index;
		this.isFirstPart = isFirstPart;
		this.yaw = new Property('yaw',index,true);
		this.pitch = new Property('pitch',index,true);
		this.roll = new Property('roll',index,true);
		this.x = new Property('x',index);
		this.y = new Property('y',index);
		this.z = new Property('z',index);
		this.properties = [this.yaw, this.pitch, this.roll, this.x, this.y, this.z];
		
		this.geometry = null;
	}
	forEach(func) {
		let l = this.isFirstPart ? 6 : 3;
		for (let i = 0; i < l; i++) {
			func(this.properties[i]);
		}
	}
	setAnimation(animation) {
		this.forEach(property => {
			property.setAnimation(animation);
		});
	}
	advanceFrame() {
		this.forEach(property => {
			property.advanceFrame();
		});
	}
}

class Actor {
	constructor(partCount) {
		this.animation = null;
		this.parts = [];
		for (let i = 0; i < partCount; i++) {
			this.parts.push(new Part(i));
		}
		this.parts[0].isFirstPart = true;
	}
	advanceFrame() {
		for (let i = 0; i < this.parts.length; i++) {
			this.parts[i].advanceFrame();
		}
	}
	setAnimation(animation) {
		this.animation = animation;
		for (let i = 0; i < this.parts.length; i++) {
			this.parts[i].setAnimation(animation);
		}
	}
}

function loadFile(fileName,callback) {
	fetch(fileName)
	.then(response => response.text())
	.then((data) => {
		callback(data);
	})
}

function decimalToHex(d, padding) {
	//https://stackoverflow.com/questions/57803/how-to-convert-decimal-to-hexadecimal-in-javascript
	var hex = Number(d).toString(16);
	padding = typeof (padding) === "undefined" || padding === null ? padding = 2 : padding;
	while (hex.length < padding) {
		hex = "0" + hex;
	}
	return hex.toUpperCase();
}

//let doubles = ['0B','0F','01','2C','3C','4D','6F','07','8E','45','56','72','88','B5','BC','CB'];
let doubles = [11,15,1,44,60,77,111,7,142,69,86,114,136,181,188,203];

function loadAnimation(index,callback) {
	let value = decimalToHex(index,2);
	let part = 0;
	if (doubles.indexOf(index) > -1) value += '_' + decimalToHex(index+1,2), part = 1;
	if (doubles.indexOf(index-1) > -1) value = decimalToHex(index-1,2) + '_' + value, part = 2;
	loadFile('./anims/' + 'anim_' + value + '.inc.c', code => {
		callback(parse(code, part));
	});
}
