import * as THREE from './vendor/three.module.js';

document.addEventListener('DOMContentLoaded', () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const BLOOM_COLORS = ['#9B7FD6', '#DD8A34', '#2B3A5C', '#7EA1EA', '#F0B454'];
    const STEM_COLOR = '#3D3252';
    const CENTER_COLOR = '#F0B454';

    const MAX_FLOWERS = 30;
    const LIFESPAN = 3.4; // seconds

    const VERTEX_SHADER = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const FRAGMENT_SHADER = `
        #define PI 3.14159265359

        varying vec2 vUv;
        uniform float u_time;
        uniform vec3 u_rand;
        uniform vec3 u_bloom_color;
        uniform vec3 u_stem_color;
        uniform vec3 u_center_color;

        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

        float snoise(vec2 v) {
            const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
            vec2 i = floor(v + dot(v, C.yy));
            vec2 x0 = v - i + dot(i, C.xx);
            vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec4 x12 = x0.xyxy + C.xxzz;
            x12.xy -= i1;
            i = mod289(i);
            vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
            vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
            m = m * m;
            m = m * m;
            vec3 x = 2.0 * fract(p * C.www) - 1.0;
            vec3 h = abs(x) - 0.5;
            vec3 ox = floor(x + 0.5);
            vec3 a0 = x - ox;
            m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
            vec3 g;
            g.x = a0.x * x0.x + h.x * x0.y;
            g.yz = a0.yz * x12.xz + h.yz * x12.yw;
            return 130.0 * dot(m, g);
        }

        float get_dot_shape(vec2 dist, float radius_max, float radius_line) {
            return 1. - smoothstep(radius_line * radius_max, radius_max, dot(dist, dist) * 4.0);
        }

        float get_stem_shape(vec2 _cursor, vec2 _uv, float _t, float _size, float _flowery, vec2 _rand) {
            float noise_power = .2;
            float cursor_horizontal_noise = noise_power * (1. + (1. - _flowery)) * snoise(3. * _uv * (_rand - .5));
            cursor_horizontal_noise *= pow(dot(_cursor.y, _cursor.y), .3 * _flowery);
            cursor_horizontal_noise *= pow(dot(_uv.y, _uv.y), .3);
            _cursor.x += cursor_horizontal_noise;

            _cursor.y *= (1. - ((1. - _flowery) * .7));
            _cursor.y += ((1. - _flowery) * .7 * _rand.x);

            float stroke_width = (1. - _flowery) * .9 * pow(dot(_uv.y, _cursor.x), 1.) + _flowery * .03;
            stroke_width -= .02;

            float left = smoothstep(-stroke_width, 0., _cursor.x);
            float right = smoothstep(stroke_width, 0., _cursor.x);
            float stem_shape = left * right;

            float stem_top_mask = smoothstep(_cursor.y - .1, _cursor.y, min(-.1, _t - 1.));
            stem_shape *= stem_top_mask;
            stem_shape += .5 * get_dot_shape(_cursor + vec2(0., .02), .15 * _size, .5);
            stem_shape *= stem_top_mask;

            return stem_shape;
        }

        void main() {
            float speed = 1.3;
            float t = speed * u_time;

            vec2 uv = vUv;
            vec2 point = vec2(0.5, 0.38);
            vec2 cursor = uv - point;

            float base_radius = .22;
            float grow_duration = .6;
            float grow_speed = 2. * speed;
            float bloom_duration = .5;

            vec3 color = vec3(0.0);
            float alpha = 0.0;

            float grown_t = min(t, grow_duration);
            float stem_shape = get_stem_shape(cursor, uv, grow_speed * grown_t, base_radius, 1., u_rand.xy);
            stem_shape += get_stem_shape(cursor, uv, grow_speed * grown_t, 0., 0., u_rand.yz);
            stem_shape += get_stem_shape(cursor, uv, grow_speed * grown_t, 0., 0., u_rand.zy);
            stem_shape = clamp(stem_shape, 0., 1.);
            color += stem_shape * u_stem_color;
            alpha = max(alpha, stem_shape);

            if (t > grow_duration - .15) {
                float bloom_t = clamp((t - (grow_duration - .15)) / bloom_duration, 0., 1.6);
                float blooming_time = max(0., pow(1.1 * bloom_t + .3, 2.) - .05);
                float radius = base_radius * min(blooming_time, 1.4);

                vec2 noisy_cursor = cursor;
                noisy_cursor.y *= (1. + u_rand.y * .4);
                noisy_cursor -= .02 * snoise(noisy_cursor * 10. + vec2(0., 10. * sin(.5 * bloom_t + PI)));

                float petal = get_dot_shape(noisy_cursor, 1.5 * radius, 0.0);
                color = mix(color, u_bloom_color, petal * .9);
                alpha = max(alpha, petal * clamp(bloom_t, 0., 1.));

                vec2 ring_cursor = noisy_cursor;
                ring_cursor.y -= .02;
                float inner_r = .7 * radius;
                float inner_w = .2 * radius;
                float ring_shape = get_dot_shape(ring_cursor, inner_r + inner_w, .9) - get_dot_shape(ring_cursor, inner_r, .9);
                color += .25 * ring_shape * vec3(1.0);
                alpha = max(alpha, ring_shape * .6);

                float center_dot = get_dot_shape(cursor, .12 * radius, 0.);
                color = mix(color, u_center_color, center_dot);
                alpha = max(alpha, center_dot);
            }

            float fade = 1.0;
            float fade_start = grow_duration + bloom_duration + .6;
            float fade_dur = 1.4;
            if (u_time > fade_start) {
                fade = clamp(1.0 - (u_time - fade_start) / fade_dur, 0., 1.);
            }

            gl_FragColor = vec4(color, alpha * fade);
        }
    `;

    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, window.innerWidth, 0, window.innerHeight, -1, 1);
    camera.position.z = 1;

    const geometry = new THREE.PlaneGeometry(1, 1);

    const resize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        camera.right = window.innerWidth;
        camera.bottom = window.innerHeight;
        camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', resize, { passive: true });
    resize();

    const hexToVec3 = (hex) => {
        const c = new THREE.Color(hex);
        return new THREE.Vector3(c.r, c.g, c.b);
    };

    const stemColorVec = hexToVec3(STEM_COLOR);
    const centerColorVec = hexToVec3(CENTER_COLOR);

    let active = [];
    let rafId = null;

    const spawnFlower = (x, y) => {
        if (active.length >= MAX_FLOWERS) {
            const oldest = active.shift();
            scene.remove(oldest.mesh);
            oldest.mesh.material.dispose();
        }

        const size = 170 + Math.random() * 110;
        const bloomColor = BLOOM_COLORS[Math.floor(Math.random() * BLOOM_COLORS.length)];

        const material = new THREE.ShaderMaterial({
            uniforms: {
                u_time: { value: 0 },
                u_rand: { value: new THREE.Vector3(Math.random(), Math.random(), Math.random()) },
                u_bloom_color: { value: hexToVec3(bloomColor) },
                u_stem_color: { value: stemColorVec },
                u_center_color: { value: centerColorVec },
            },
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.scale.set(size, size, 1);
        mesh.position.set(x, y, 0);
        scene.add(mesh);

        active.push({ mesh, born: performance.now() });

        if (!rafId) {
            rafId = requestAnimationFrame(tick);
        }
    };

    const tick = () => {
        const now = performance.now();
        active = active.filter((f) => {
            const age = (now - f.born) / 1000;
            if (age > LIFESPAN) {
                scene.remove(f.mesh);
                f.mesh.material.dispose();
                return false;
            }
            f.mesh.material.uniforms.u_time.value = age;
            return true;
        });

        renderer.render(scene, camera);

        if (active.length > 0) {
            rafId = requestAnimationFrame(tick);
        } else {
            rafId = null;
        }
    };

    document.addEventListener('click', (event) => {
        spawnFlower(event.clientX, event.clientY);
    });
});
