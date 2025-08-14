document.addEventListener('DOMContentLoaded', () => {
    // Tab switching logic
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // Volume controls
    const music = document.getElementById('bgMusic');
    const musicSlider = document.getElementById('musicVolume');
    if (musicSlider) {
        musicSlider.addEventListener('input', () => {
            music.volume = musicSlider.value;
        });
    }

    // Background balls
    const canvas = document.getElementById('ballCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    class Ball {
        constructor(x, y, radius, color, dx, dy) {
            this.x = x;
            this.y = y;
            this.radius = radius;
            this.color = color;
            this.dx = dx;
            this.dy = dy;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.closePath();
        }

        update() {
            this.x += this.dx;
            this.y += this.dy;

            if (this.x + this.radius > canvas.width || this.x - this.radius < 0) {
                this.dx *= -1;
            }
            if (this.y + this.radius > canvas.height || this.y - this.radius < 0) {
                this.dy *= -1;
            }

            this.draw();
        }
    }

    const balls = [
        new Ball(canvas.width - 100, 150, 30, '#4a90e2', -2, 3),
        new Ball(canvas.width - 200, 350, 30, '#5cb3ff', -3, 2),
        new Ball(canvas.width - 250, 250, 30, '#8ab6f9', -2.5, 2.5)
        new Ball(canvas.width - 200, 250, 30, '#8ab6f9', -2.5, 2.5)
        new Ball(canvas.width - 300, 250, 30, '#8ab6f9', -2.5, 2.5)
    ];

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        balls.forEach(ball => ball.update());
        requestAnimationFrame(animate);
    }

    animate();

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
});
