// Chrome: --allow-file-access-from-files

var SHADOW_VSHADER_SOURCE =
	'attribute vec4 a_Position;\n' +
	'uniform mat4 u_MvpMatrix;\n' +
	'void main() {\n' +
	'	gl_Position = u_MvpMatrix * a_Position;\n' +
	'}\n';

var SHADOW_FSHADER_SOURCE =
	'#ifdef GL_ES\n' +
	'precision mediump float;\n' +
	'#endif\n' +
	'void main() {\n' +
	'	const vec4 bitShift = vec4(1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0);\n' +
	'	const vec4 bitMask = vec4(1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0, 0.0);\n' +
	'	vec4 rgbaDepth = fract(gl_FragCoord.z * bitShift);\n' +
	'	rgbaDepth -= rgbaDepth.gbaa * bitMask;\n' +
	'	gl_FragColor = rgbaDepth;\n' +
	'}\n';

var NORMAL_VSHADER_SOURCE =
	'attribute vec4 a_Position;\n' +
	'attribute vec2 a_TextureCoordinates;\n' +
	'attribute vec4 a_Normal;\n' +
	'uniform mat4 u_MvpMatrix;\n' +
	'uniform mat4 u_ModelMatrix;\n' +
	'uniform mat4 u_NormalMatrix;\n' +
	'uniform mat4 u_MvpMatrixFromLight;\n' +
	'varying vec2 v_TextureCoordinates;\n' +
	'varying vec3 v_Position;\n' +
	'varying vec3 v_Normal;\n' +
	'varying vec4 v_PositionFromLight;\n' +
	'void main() {\n' +
	'	gl_Position = u_MvpMatrix * a_Position;\n' +
	'	v_TextureCoordinates = a_TextureCoordinates;\n' +
	'	v_Position = vec3(u_ModelMatrix * a_Position);\n'+
	'	v_Normal = normalize(vec3(u_NormalMatrix * a_Normal));\n' +
	'	v_PositionFromLight = u_MvpMatrixFromLight * a_Position;' +
	'}\n';

var NORMAL_FSHADER_SOURCE =
	'#ifdef GL_ES\n' +
	'precision mediump float;\n' +
	'#endif\n' +
	'uniform sampler2D u_TextureSampler;\n' +
	'uniform vec3 u_LightPosition;\n' +
	'uniform vec3 u_LightColor;\n' +
	'uniform vec3 u_AmbientLightColor;\n' +
	'uniform sampler2D u_ShadowMap;\n' +
	'varying vec2 v_TextureCoordinates;\n' +
	'varying vec3 v_Position;\n' +
	'varying vec3 v_Normal;\n' +
	'varying vec4 v_PositionFromLight;\n' +
	'float unpackDepth(const in vec4 rgbaDepth) {\n' +
	'	const vec4 bitShift = vec4(1.0, 1.0 / 256.0, 1.0 / (256.0 * 256.0), 1.0 / (256.0 * 256.0 * 256.0));\n' +
	'	float depth = dot(rgbaDepth, bitShift);\n' +
	'	return depth;\n' +
	'}\n' +
	'void main() {\n' +
	'	vec4 texelColor = texture2D(u_TextureSampler, v_TextureCoordinates);\n' +
	'	vec3 lightDirection = normalize(u_LightPosition - v_Position);\n' +
	'	vec3 normal = normalize(v_Normal);\n' +
	'	float nDotL = max(dot(lightDirection, normal), 0.0);\n' +
	'	vec3 diffuse = u_LightColor * texelColor.rgb * nDotL;\n' +
	'	vec3 ambient = u_AmbientLightColor * texelColor.rgb;\n' +
	'	vec3 shadowCoord = (v_PositionFromLight.xyz / v_PositionFromLight.w) / 2.0 + 0.5;\n' +
	'	vec4 rgbaDepth = texture2D(u_ShadowMap, shadowCoord.xy);\n' +
	'	float depth = unpackDepth(rgbaDepth);\n' +
	'	float visibility = (shadowCoord.z > depth + 0.0005) ? 0.7 : 1.0;\n' +
	'	gl_FragColor = vec4((diffuse + ambient) * visibility, texelColor.a);\n' +
	'}\n';

var FIREWORK_VSHADER_SOURCE =
	'attribute vec4 a_Position;\n' +
	'attribute vec2 a_TextureCoordinates;\n' +
	'uniform mat4 u_MvpMatrix;\n' +
	'varying vec2 v_TextureCoordinates;\n' +
	'void main() {\n' +
	'	gl_Position = u_MvpMatrix * a_Position;\n' +
	'	v_TextureCoordinates = a_TextureCoordinates;\n' +
	'}\n';

var FIREWORK_FSHADER_SOURCE =
	'#ifdef GL_ES\n' +
	'precision mediump float;\n' +
	'#endif\n' +
	'uniform sampler2D u_Sampler;\n' +
	'uniform vec4 u_Color;\n' +
	'varying vec2 v_TextureCoordinates;\n' +
	'void main() {\n' +
	'	vec4 texelColor = texture2D(u_Sampler, v_TextureCoordinates);\n' +
	'	gl_FragColor = texelColor * u_Color;\n' +
	'}\n';

//===============================================================================================//

var canvasGL;
var gl;

var canvasHUD;
var hud;

var shadowProgram;
var normalProgram;
var fireworkProgram;

var ballBuffers;
var ballTexture;

var cubeBuffers;
var cubeTexture;

var planeBuffers;
var planeTexture;

var fireworkBuffers;
var fireworkTexture;

var frameBuffer;

var g_modelMatrix = mat4.create();
var g_viewMatrix = mat4.create();
var g_projMatrix = mat4.create();
var g_mvpMatrix = mat4.create();

var g_normalMatrix = mat4.create();

var g_viewProjMatrixFromLight = mat4.create();
var g_mvp_ball = mat4.create();
var g_mvp_plane = mat4.create();

var g_ballRotationMatrix = mat4.create();
var g_ballRotationAxisX = vec3.fromValues(1, 0, 0);
var g_ballRotationAxisZ = vec3.fromValues(0, 0, 1);

var OFFSCREEN_WIDTH	= 4096;
var OFFSCREEN_HEIGHT = 2048;
var PLANE_WIDTH = 60;
var PLANE_HEIGHT = 30;
var BALL_RADIUS = 2;
var BALL_VELOCITY = 10;
var BALL_ACCELERATION = 2;
var CUBE_NUM = 18;
var CUBE_ANGLE_STEP = 0.5 * Math.PI;
var WON = false;
var ENDLESS_MODE = false;

var g_eyePosition = vec3.fromValues(0, 25, 25);
var g_ballPosition = vec3.fromValues(0, 0, 0);
var g_eyeUpVector = vec3.fromValues(0, 1, 0);

var g_lightPosition = vec3.fromValues(0, 20, -5);
var g_centerPosition = vec3.fromValues(0, 0, 0);
var g_lightUpVector = vec3.fromValues(0, 1, 1);

var g_lightColor = vec3.fromValues(1, 1, 1);
var g_ambientLightColor = vec3.fromValues(0.2, 0.2, 0.2);

var g_time = Date.now();
var g_angle = 0;
var g_velocity_x = 0;
var g_velocity_z = 0;
var g_delay = 0;
var g_score = 0;
var g_cubes = [];
var g_fireworks = [];

//===============================================================================================//

function main()
{
	canvasGL = document.getElementById('webgl');
	gl = canvasGL.getContext('experimental-webgl');

	canvasHUD = document.getElementById('hud');
	hud = canvasHUD.getContext('2d');

	shadowProgram = initShadowProgram();
	normalProgram = initNormalProgram();
	fireworkProgram = initFireworkProgram();

	ballBuffers = initVertexBuffersForBall();
	ballTexture = initTexture('src/ball.jpg');

	cubeBuffers = initVertexBuffersForCube();
	cubeTexture = initTexture('src/question.jpg');

	planeBuffers = initVertexBuffersForPlane();
	planeTexture = initTexture('src/field.jpg');

	fireworkBuffers = initVertexBuffersForFirework();
	fireworkTexture = initTexture('src/star.gif');

	frameBuffer = initFramebufferObject();
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, frameBuffer.texture);

	g_cubes = initCubes(CUBE_NUM);

	mat4.lookAt(g_viewMatrix, g_lightPosition, g_centerPosition, g_lightUpVector);
	mat4.perspective(g_projMatrix, 0.75 * Math.PI, OFFSCREEN_WIDTH / OFFSCREEN_HEIGHT, 1, 200);
	mat4.multiply(g_viewProjMatrixFromLight, g_projMatrix, g_viewMatrix);
	
	mat4.lookAt(g_viewMatrix, g_eyePosition, g_ballPosition, g_eyeUpVector);
	mat4.perspective(g_projMatrix, 0.25 * Math.PI, canvasGL.width / canvasGL.height, 1, 200);

	gl.clearColor(0.0, 1.0, 1.0, 1.0);
	gl.enable(gl.DEPTH_TEST);

	document.onkeydown = function(ev) {
		handleKeyDown(ev);
	}

	tick();
}

//===============================================================================================//

function initShadowProgram() {
	var program = createProgram(gl, SHADOW_VSHADER_SOURCE, SHADOW_FSHADER_SOURCE);

	program.a_Position = gl.getAttribLocation(program, 'a_Position');

	program.u_MvpMatrix = gl.getUniformLocation(program, 'u_MvpMatrix');

	return program;
}

function initNormalProgram() {
	var program = createProgram(gl, NORMAL_VSHADER_SOURCE, NORMAL_FSHADER_SOURCE);

	program.a_Position = gl.getAttribLocation(program, 'a_Position');
	program.a_TextureCoordinates = gl.getAttribLocation(program, 'a_TextureCoordinates');
	program.a_Normal = gl.getAttribLocation(program, 'a_Normal');

	program.u_MvpMatrix = gl.getUniformLocation(program, 'u_MvpMatrix');
	program.u_ModelMatrix = gl.getUniformLocation(program, 'u_ModelMatrix');
	program.u_NormalMatrix = gl.getUniformLocation(program, 'u_NormalMatrix');
	program.u_MvpMatrixFromLight = gl.getUniformLocation(program, 'u_MvpMatrixFromLight');
	program.u_TextureSampler = gl.getUniformLocation(program, 'u_TextureSampler');
	program.u_LightPosition = gl.getUniformLocation(program, 'u_LightPosition');
	program.u_LightColor = gl.getUniformLocation(program, 'u_LightColor');
	program.u_AmbientLightColor = gl.getUniformLocation(program, 'u_AmbientLightColor');
	program.u_ShadowMap = gl.getUniformLocation(program, 'u_ShadowMap');

	return program;
}

function initFireworkProgram() {
	var program = createProgram(gl, FIREWORK_VSHADER_SOURCE, FIREWORK_FSHADER_SOURCE);

	program.a_Position = gl.getAttribLocation(program, 'a_Position');
	program.a_TextureCoordinates = gl.getAttribLocation( program, 'a_TextureCoordinates');

	program.u_MvpMatrix = gl.getUniformLocation(program, 'u_MvpMatrix');
	program.u_Sampler = gl.getUniformLocation(program, 'u_Sampler');
	program.u_Color = gl.getUniformLocation(program, 'u_Color');

	return program;
}

function createProgram(gl, vsource, fsource) {
	var vshader = loadShader(gl, gl.VERTEX_SHADER, vsource);
	var fshader = loadShader(gl, gl.FRAGMENT_SHADER, fsource);
	if (!vshader || !fshader) {
		return null;
	}

	var program = gl.createProgram();
	if (!program) {
		return null;
	}

	gl.attachShader(program, vshader);
	gl.attachShader(program, fshader);

	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		return null;
	}

	return program;
}

function loadShader(gl, type, source) {
	var shader = gl.createShader(type);

	gl.shaderSource(shader, source);

	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		return null;
	}

	return shader;
}

//===============================================================================================//

function initVertexBuffersForBall() {
	var DIV = 30;

	var i, ai, si, ci;
	var j, aj, sj, cj;
	var p1, p2;

	var positionData = [];
	var textureCoordinatesData = [];
	var indices = [];

	for (j = 0; j <= DIV; ++j) {
		aj = j * Math.PI / DIV;
		sj = Math.sin(aj);
		cj = Math.cos(aj);

		for (i = 0; i <= DIV; ++i) {
			ai = i * 2 * Math.PI / DIV;
			si = Math.sin(ai);
			ci = Math.cos(ai);

			positionData.push(si * sj * BALL_RADIUS);
			positionData.push(cj * BALL_RADIUS);
			positionData.push(ci * sj * BALL_RADIUS);

			textureCoordinatesData.push(1 - (i / DIV));
			textureCoordinatesData.push(1 - (j / DIV));
		}
	}

	for (j = 0; j < DIV; ++j) {
		for (i = 0; i < DIV; ++i) {
			p1 = j * (DIV + 1) + i;
			p2 = p1 + (DIV + 1);

			indices.push(p1);
			indices.push(p2);
			indices.push(p1 + 1);

			indices.push(p1 + 1);
			indices.push(p2);
			indices.push(p2 + 1);
		}
	}

	var obj = new Object();

	obj.positionBuffer = initArrayBuffer(new Float32Array(positionData), 3, gl.FLOAT);
	obj.textureCoordinatesBuffer = initArrayBuffer(new Float32Array(textureCoordinatesData), 2, gl.FLOAT);
	obj.normalBuffer = initArrayBuffer(new Float32Array(positionData), 3, gl.FLOAT);
	obj.indexBuffer = initElementArrayBuffer(new Uint16Array(indices), gl.UNSIGNED_SHORT);

	obj.numIndices = indices.length;

	return obj;
}

function initVertexBuffersForCube() {
	var positionData = new Float32Array([
		-1.0, -1.0,  1.0,	 1.0, -1.0,  1.0,	 1.0,  1.0,  1.0,	-1.0,  1.0,  1.0,
		-1.0, -1.0, -1.0,	-1.0,  1.0, -1.0,	 1.0,  1.0, -1.0,	 1.0, -1.0, -1.0,
		-1.0,  1.0, -1.0,	-1.0,  1.0,  1.0,	 1.0,  1.0,  1.0,	 1.0,  1.0, -1.0,
		-1.0, -1.0, -1.0,	 1.0, -1.0, -1.0,	 1.0, -1.0,  1.0,	-1.0, -1.0,  1.0,
		 1.0, -1.0, -1.0,	 1.0,  1.0, -1.0,	 1.0,  1.0,  1.0,	 1.0, -1.0,  1.0,
		-1.0, -1.0, -1.0,	-1.0, -1.0,  1.0,	-1.0,  1.0,  1.0,	-1.0,  1.0, -1.0
	]);

	var textureCoordinatesData = new Float32Array([
		0.0, 0.0,	1.0, 0.0,	1.0, 1.0,	0.0, 1.0,
		1.0, 0.0,	1.0, 1.0,	0.0, 1.0,	0.0, 0.0,
		0.0, 1.0,	0.0, 0.0,	1.0, 0.0,	1.0, 1.0,
		1.0, 1.0,	0.0, 1.0,	0.0, 0.0,	1.0, 0.0,
		1.0, 0.0,	1.0, 1.0,	0.0, 1.0,	0.0, 0.0,
		0.0, 0.0,	1.0, 0.0,	1.0, 1.0,	0.0, 1.0
	]);

	var normalData = new Float32Array([
		 0.0,  0.0,  1.0,	 0.0,  0.0,  1.0,	 0.0,  0.0,  1.0,	 0.0,  0.0,  1.0,
         0.0,  0.0, -1.0,	 0.0,  0.0, -1.0,	 0.0,  0.0, -1.0,	 0.0,  0.0, -1.0,
         0.0,  1.0,  0.0,	 0.0,  1.0,  0.0,	 0.0,  1.0,  0.0,	 0.0,  1.0,  0.0,
         0.0, -1.0,  0.0,	 0.0, -1.0,  0.0,	 0.0, -1.0,  0.0,	 0.0, -1.0,  0.0,
         1.0,  0.0,  0.0,	 1.0,  0.0,  0.0,	 1.0,  0.0,  0.0,	 1.0,  0.0,  0.0,
        -1.0,  0.0,  0.0,	-1.0,  0.0,  0.0,	-1.0,  0.0,  0.0,	-1.0,  0.0,  0.0,
    ]);

	var indices = new Uint8Array([
		 0,  1,  2,		 0,  2,  3,
         4,  5,  6,		 4,  6,  7,
         8,  9, 10,		 8, 10, 11,
        12, 13, 14,		12, 14, 15,
        16, 17, 18,		16, 18, 19,
        20, 21, 22,		20, 22, 23
	]);

	var obj = new Object();

	obj.positionBuffer = initArrayBuffer(positionData, 3, gl.FLOAT);
	obj.textureCoordinatesBuffer = initArrayBuffer(textureCoordinatesData, 2, gl.FLOAT);
	obj.normalBuffer = initArrayBuffer(normalData, 3, gl.FLOAT);
	obj.indexBuffer = initElementArrayBuffer(indices, gl.UNSIGNED_BYTE);

	obj.numIndices = indices.length;

	return obj;
}

function initVertexBuffersForPlane() {
	var bottom = (BALL_RADIUS > Math.sqrt(2)) ? BALL_RADIUS : Math.sqrt(2);
	var positionData = new Float32Array([
		-PLANE_WIDTH, -bottom, -PLANE_HEIGHT,
		 PLANE_WIDTH, -bottom, -PLANE_HEIGHT,
		 PLANE_WIDTH, -bottom,  PLANE_HEIGHT,
		-PLANE_WIDTH, -bottom,  PLANE_HEIGHT
	]);

	var textureCoordinatesData = new Float32Array([
		0.0, 1.0,
		1.0, 1.0,
		1.0, 0.0,
		0.0, 0.0
	]);

	var normalData = new Float32Array([
		0.0, 1.0, 0.0,
		0.0, 1.0, 0.0,
		0.0, 1.0, 0.0,
		0.0, 1.0, 0.0,
	]);

	var indices = new Uint8Array([0, 1, 2, 0, 2, 3]);

	var obj = new Object();

	obj.positionBuffer = initArrayBuffer(positionData, 3, gl.FLOAT);
	obj.textureCoordinatesBuffer = initArrayBuffer(textureCoordinatesData, 2, gl.FLOAT);
	obj.normalBuffer = initArrayBuffer(normalData, 3, gl.FLOAT);
	obj.indexBuffer = initElementArrayBuffer(indices, gl.UNSIGNED_BYTE);

	obj.numIndices = indices.length;

	return obj;
}

function initVertexBuffersForFirework() {
	var positionData = new Float32Array([
		-0.2, -0.2,  0.0,
		 0.2, -0.2,  0.0,
		-0.2,  0.2,  0.0,
		 0.2,  0.2,  0.0
	]);

	var textureCoordinatesData = new Float32Array([
		0.0, 1.0,
		1.0, 1.0,
		0.0, 0.0,
		1.0, 0.0	
	]);

	var obj = new Object();

	obj.positionBuffer = initArrayBuffer(positionData, 3, gl.FLOAT);
	obj.textureCoordinatesBuffer = initArrayBuffer(textureCoordinatesData, 2, gl.FLOAT);

	obj.numItems = 4;

	return obj;
}

function initArrayBuffer(data, num, type) {
	var buffer = gl.createBuffer();

	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	buffer.num = num;
	buffer.type = type;

	return buffer;
}

function initElementArrayBuffer(data, type) {
	var buffer = gl.createBuffer();

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

	buffer.type = type;

	return buffer;
}

//===============================================================================================//

function initTexture(directory) {
	var texture = gl.createTexture();

	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
	gl.bindTexture(gl.TEXTURE_2D, null);

	var image = new Image();
	
	image.onload = function() {
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.bindTexture(gl.TEXTURE_2D, null);
	};

	image.crossOrigin = "Anonymous";
	image.src = directory;

	return texture;
}

function initFramebufferObject() {
	var framebuffer, texture, depthBuffer;

	framebuffer = gl.createFramebuffer();

	texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	depthBuffer = gl.createRenderbuffer();
	gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
	gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT);

	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
	gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);
	
	framebuffer.texture = texture;

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.bindTexture(gl.TEXTURE_2D, null);
	gl.bindRenderbuffer(gl.RENDERBUFFER, null);

	return framebuffer;
}

function initCubes(num) {
	var cubes = [];

	if (!ENDLESS_MODE) {
		var radius = 0.6 * (PLANE_WIDTH < PLANE_HEIGHT ? PLANE_WIDTH : PLANE_HEIGHT);
		var angle = 0;
		var step = 2 * Math.PI / num;

		for (var i = 0; i < num; ++i) {
			var cube = new Object();

			cube.x = radius * Math.sin(angle);
			cube.y = 0;
			cube.z = -radius * Math.cos(angle);
			cube.lock = false;
			cube.mvp = mat4.create();

			cubes.push(cube);

			angle += step;
		}
	} else {
		for (var i = 0; i < num; ++i) {
			var cube = new Object();

			cube.x = 2 * PLANE_WIDTH * Math.random() - PLANE_WIDTH;
			cube.y = 0;
			cube.z = 2 * PLANE_HEIGHT * Math.random() - PLANE_HEIGHT;
			cube.lock = false;
			cube.mvp = mat4.create();

			cubes.push(cube);
		}
	}

	return cubes;
}

//===============================================================================================//

function handleKeyDown(ev) {
	switch (ev.keyCode) {
	case 32:
		g_velocity_x = 0;
		g_velocity_z = 0;
		break;
	case 37:
		g_velocity_x = -BALL_VELOCITY;
		g_velocity_z *= 0.7;
		break;
	case 38:
		g_velocity_z = -BALL_VELOCITY;
		g_velocity_x *= 0.7;
		break;
	case 39:
		g_velocity_x = BALL_VELOCITY;
		g_velocity_z *= 0.7;
		break;
	case 40:
		g_velocity_z = BALL_VELOCITY;
		g_velocity_x *= 0.7;
		break;
	case 107:
		g_eyePosition[1] += 1;
		g_eyePosition[2] += 0.25;
		break;
	case 109:
		g_eyePosition[1] -= 1;
		g_eyePosition[2] -= 0.25;
		break;
	default:
		return;
	}
}

function tick() {
	animate();
	checkScore();
	checkForCollision();

	gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
	gl.viewport(0, 0, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	gl.useProgram(shadowProgram);
	drawSceneShadow();

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.viewport(0, 0, canvasGL.width, canvasGL.height);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	gl.useProgram(normalProgram);
	drawSceneNormal();

	gl.useProgram(fireworkProgram);
	drawSceneFirework();

	drawHUD();

	window.requestAnimationFrame(tick, canvasGL);
}

function animate() {
	var newTime = Date.now();
	var elapsed = (newTime - g_time) * 0.001;
	g_time = newTime;

	g_angle = g_angle + CUBE_ANGLE_STEP * elapsed;
	
	var dx = g_velocity_x * elapsed;
	var dz = g_velocity_z * elapsed;

	vec3.set(g_ballPosition, g_ballPosition[0] + dx, g_ballPosition[1], g_ballPosition[2] + dz);
	vec3.set(g_eyePosition, g_eyePosition[0] + dx, g_eyePosition[1], g_eyePosition[2] + dz);

	mat4.lookAt(g_viewMatrix, g_eyePosition, g_ballPosition, g_eyeUpVector);

	dx = -dx / BALL_RADIUS;
	dz = dz / BALL_RADIUS;

	mat4.rotate(g_ballRotationMatrix, g_ballRotationMatrix, dx, g_ballRotationAxisZ);
	mat4.fromRotation(g_modelMatrix, -dx, g_ballRotationAxisZ);
	vec3.transformMat4(g_ballRotationAxisX, g_ballRotationAxisX, g_modelMatrix);

	mat4.rotate(g_ballRotationMatrix, g_ballRotationMatrix, dz, g_ballRotationAxisX);
	mat4.fromRotation(g_modelMatrix, -dz, g_ballRotationAxisX);
	vec3.transformMat4(g_ballRotationAxisZ, g_ballRotationAxisZ, g_modelMatrix);

	var acceleration = BALL_ACCELERATION * elapsed;

	if (g_velocity_x > 0) {
		g_velocity_x -= acceleration;
	} else if (g_velocity_x < 0) {
		g_velocity_x += acceleration;
	}

	if (g_velocity_z > 0) {
		g_velocity_z -= acceleration;
	} else if (g_velocity_z < 0) {
		g_velocity_z += acceleration;
	}

	var newFireworks = [];
	for (var i = 0; i < g_fireworks.length; ++i) {
		g_fireworks[i].decreaseLifeTime();
		if (!g_fireworks[i].lock) {
			newFireworks.push(g_fireworks[i]);
		}
	}
	g_fireworks = newFireworks;
}

function checkScore() {
	var award = 100;
	var minDistance = (BALL_RADIUS + Math.sqrt(2)) * (BALL_RADIUS + Math.sqrt(2));
	var distance;

	for (var i = 0; i < g_cubes.length; ++i) {
		if (!g_cubes[i].lock) {
			distance =
				(g_ballPosition[0] - g_cubes[i].x) * (g_ballPosition[0] - g_cubes[i].x) +
				(g_ballPosition[2] - g_cubes[i].z) * (g_ballPosition[2] - g_cubes[i].z);

			if (distance <= minDistance) {
				if (ENDLESS_MODE) {
					g_fireworks.push(new Firework(g_cubes[i].x, g_cubes[i].y, g_cubes[i].z));
					g_cubes[i].x = 2 * PLANE_WIDTH * Math.random() - PLANE_WIDTH;
					g_cubes[i].z = 2 * PLANE_HEIGHT * Math.random() - PLANE_HEIGHT;
				} else {
					g_fireworks.push(new Firework(g_cubes[i].x, g_cubes[i].y, g_cubes[i].z));
					g_cubes[i].lock = true;
				}

				g_score += award;
				g_delay = 100;
			}
		}
	}

	if (!WON && g_score == (award * g_cubes.length)) {
		WON = true;
		g_score = 0;
		g_delay = 500;
	}
}

function checkForCollision() {
	var u = g_ballPosition[0] + BALL_RADIUS;
	var v = g_ballPosition[2] + BALL_RADIUS;

	if (u > PLANE_WIDTH) {
		g_ballPosition[0] -= 0.15;
		g_eyePosition[0] -= 0.15;
		g_velocity_x = -g_velocity_x;
	}

	if (v > PLANE_HEIGHT) {
		g_ballPosition[2] -= 0.15;
		g_eyePosition[2] -= 0.15;
		g_velocity_z = -g_velocity_z;
	}

	u = g_ballPosition[0] - BALL_RADIUS;
	v = g_ballPosition[2] - BALL_RADIUS;

	if (u < -PLANE_WIDTH) {
		g_ballPosition[0] += 0.15;
		g_eyePosition[0] += 0.15;
		g_velocity_x = -g_velocity_x;
	}

	if (v < -PLANE_HEIGHT) {
		g_ballPosition[2] += 0.15;
		g_eyePosition[2] += 0.15;
		g_velocity_z = -g_velocity_z;
	}
}

//===============================================================================================//

function drawSceneShadow() {
	mat4.fromTranslation(g_modelMatrix, g_ballPosition);
	mat4.multiply(g_modelMatrix, g_modelMatrix, g_ballRotationMatrix);
	shadowDraw(ballBuffers);
	g_mvp_ball = mat4.clone(g_mvpMatrix);

	for (var i = 0; i < g_cubes.length; ++i) {
		if (!g_cubes[i].lock) {
			mat4.fromTranslation(g_modelMatrix, vec3.fromValues(g_cubes[i].x, g_cubes[i].y, g_cubes[i].z));
			mat4.rotate(g_modelMatrix, g_modelMatrix, g_angle, vec3.fromValues(1, 1, 1));
			shadowDraw(cubeBuffers);
			g_cubes[i].mvp = mat4.clone(g_mvpMatrix);
		}
	}

	mat4.identity(g_modelMatrix);
	shadowDraw(planeBuffers);
	g_mvp_plane = mat4.clone(g_mvpMatrix);
}

function shadowDraw(buffers) {
	mat4.multiply(g_mvpMatrix, g_viewProjMatrixFromLight, g_modelMatrix);

	initAttributeVariable(shadowProgram.a_Position, buffers.positionBuffer);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffer);

	gl.uniformMatrix4fv(shadowProgram.u_MvpMatrix, false, g_mvpMatrix);

	gl.drawElements(gl.TRIANGLES, buffers.numIndices, buffers.indexBuffer.type, 0);
}

function drawSceneNormal() {
	gl.uniform1i(normalProgram.u_ShadowMap, 0);

	mat4.fromTranslation(g_modelMatrix, g_ballPosition);
	mat4.multiply(g_modelMatrix, g_modelMatrix, g_ballRotationMatrix);
	normalDraw(ballBuffers, ballTexture, g_mvp_ball);

	for (var i = 0; i < g_cubes.length; ++i) {
		if (!g_cubes[i].lock) {
			mat4.fromTranslation(g_modelMatrix, vec3.fromValues(g_cubes[i].x, g_cubes[i].y, g_cubes[i].z));
			mat4.rotate(g_modelMatrix, g_modelMatrix, g_angle, vec3.fromValues(1, 1, 1));
			normalDraw(cubeBuffers, cubeTexture, g_cubes[i].mvp);
		}
	}

	mat4.identity(g_modelMatrix);
	normalDraw(planeBuffers, planeTexture, g_mvp_plane);
}

function normalDraw(buffers, texture, mvpMatrixFromLight) {
	mat4.multiply(g_mvpMatrix, mat4.multiply(g_mvpMatrix, g_projMatrix, g_viewMatrix), g_modelMatrix);
	mat4.transpose(g_normalMatrix, mat4.invert(g_normalMatrix, g_modelMatrix));

	initAttributeVariable(normalProgram.a_Position, buffers.positionBuffer);
	initAttributeVariable(normalProgram.a_TextureCoordinates, buffers.textureCoordinatesBuffer);
	initAttributeVariable(normalProgram.a_Normal, buffers.normalBuffer);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffer);

	gl.uniformMatrix4fv(normalProgram.u_MvpMatrix, false, g_mvpMatrix);
	gl.uniformMatrix4fv(normalProgram.u_ModelMatrix, false, g_modelMatrix);
	gl.uniformMatrix4fv(normalProgram.u_NormalMatrix, false, g_normalMatrix);
	gl.uniformMatrix4fv(normalProgram.u_MvpMatrixFromLight, false, mvpMatrixFromLight);

	gl.uniform3fv(normalProgram.u_LightPosition, g_lightPosition);
	gl.uniform3fv(normalProgram.u_LightColor, g_lightColor);
	gl.uniform3fv(normalProgram.u_AmbientLightColor, g_ambientLightColor);

	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.uniform1i(normalProgram.u_TextureSampler, 1);

	gl.drawElements(gl.TRIANGLES, buffers.numIndices, buffers.indexBuffer.type, 0);

	gl.bindTexture(gl.TEXTURE_2D, null);
}

function initAttributeVariable(a_attribute, buffer) {
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.vertexAttribPointer(a_attribute, buffer.num, buffer.type, false, 0, 0);
	gl.enableVertexAttribArray(a_attribute);
}

//===============================================================================================//

function drawSceneFirework() {
	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

	for (var i = 0; i < g_fireworks.length; ++i)
		g_fireworks[i].draw();

	gl.disable(gl.BLEND);
	gl.enable(gl.DEPTH_TEST);
}

function drawHUD() {
	hud.clearRect(0, 0, canvasHUD.width, canvasHUD.height);

	var fontSize;
	var text;

	if (ENDLESS_MODE || !WON) {
		fontSize = 50;
		text = 'Your score: ' + g_score.toString();

		hud.font = fontSize.toString() + 'px "Times New Roman"';
		hud.fillStyle = 'rgba(255, 0, 0, 1)';
		hud.fillText(text, canvasHUD.width * 0.5 - text.length * fontSize * 0.2, fontSize);

		if (g_delay > 0) {
			var r = Math.round(Math.random() * 255);
			var g = Math.round(Math.random() * 255);
			var b = Math.round(Math.random() * 255);

			hud.fillStyle = 'rgba(' + r.toString() + ', ' + g.toString() + ', ' + b.toString() + ', 1)';
			hud.fillText('+100', canvasHUD.width * 0.5 - fontSize, canvasHUD.height * 0.5 + g_delay);

			--g_delay;
		}
	} else if (g_delay > 0) {
		var visibility = g_delay * 0.002;
		fontSize = 100;
		text = 'Feeding frenzy!!!';

		hud.font = fontSize.toString() + 'px "Times New Roman"';
		hud.fillStyle = 'rgba(255, 0, 255, ' + visibility + ')';
		hud.fillText(text, canvasHUD.width * 0.5 - text.length * fontSize * 0.2, canvasHUD.height / 2);

		--g_delay;
	} else {
		ENDLESS_MODE = true;
		CUBE_NUM = 100;
		g_cubes = initCubes(CUBE_NUM);
	}
}

//===============================================================================================//

function FireworkParticle(x, y, z) {
	this.x = x;
	this.y = y;
	this.z = z;
	this.r = Math.random();
	this.g = Math.random();
	this.b = Math.random();
}

FireworkParticle.prototype = {
	draw: function(x0, y0, z0, radius) {
		mat4.fromTranslation(g_modelMatrix, vec3.fromValues(x0 + this.x * radius, y0 + this.y * radius, z0 + this.z * radius));
		mat4.scale(g_modelMatrix, g_modelMatrix, vec3.fromValues(BALL_RADIUS, BALL_RADIUS, BALL_RADIUS));
		mat4.rotate(g_modelMatrix, g_modelMatrix, g_angle * 100, vec3.fromValues(1, 1, 1));

		mat4.multiply(g_mvpMatrix, mat4.multiply(g_mvpMatrix, g_projMatrix, g_viewMatrix), g_modelMatrix);

		initAttributeVariable(fireworkProgram.a_Position, fireworkBuffers.positionBuffer);
		initAttributeVariable(fireworkProgram.a_TextureCoordinates, fireworkBuffers.textureCoordinatesBuffer);

		gl.uniformMatrix4fv(fireworkProgram.u_MvpMatrix, false, g_mvpMatrix);
		
		gl.uniform4f(fireworkProgram.u_Color, this.r, this.g, this.b, 1.0);

		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, fireworkTexture);
		gl.uniform1i(fireworkProgram.u_Sampler, 1);

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, fireworkBuffers.numItems);

		gl.bindTexture(gl.TEXTURE_2D, null);
	}
};

//===============================================================================================//

function Firework(x0, y0, z0) {
	this.x0 = x0;
	this.y0 = y0;
	this.z0 = z0;
	this.num = 100;
	this.lifeTime = 100;
	this.lock = false;
	this.elements = [];

	for (var i = 0; i < 360; i += 36) {
		phi = i * Math.PI / 180;

		for (var j = 0; j < 360; j += 36) {
			theta = j * Math.PI / 180;

			var cosPhi = Math.cos(phi);
			var sinPhi = Math.sin(phi);
			var cosTheta = Math.cos(theta);
			var sinTheta = Math.sin(theta);

			this.elements.push(new FireworkParticle(cosPhi * sinTheta, cosTheta, sinPhi * sinTheta));
		}
	}
}

Firework.prototype = {
	draw: function() {
		for (var i = 0; i < this.num; ++i) {
			this.elements[i].draw(this.x0, this.y0, this.z0, (100 - this.lifeTime) * 0.2);
		}
	},

	decreaseLifeTime: function() {
		--this.lifeTime;

		if (this.lifeTime < 0) {
			this.lock = true;
		}
	}
};