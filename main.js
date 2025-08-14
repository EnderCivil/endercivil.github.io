document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
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

    // Volume control
    const music = document.getElementById('bgMusic');
    const musicSlider = document.getElementById('musicVolume');
    if (musicSlider) {
        musicSlider.addEventListener('input', () => {
            music.volume = musicSlider.value;
        });
    }

    // Background Balls Animation
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
    new Ball(canvas.width - 100, 150, 30, '#e74c3c', -2, 3),
    new Ball(canvas.width - 200, 350, 30, '#2ecc71', -3, 2),
    new Ball(canvas.width - 250, 250, 30, '#3498db', -2.5, 2.5),
    new Ball(canvas.width - 300, 450, 30, '#9b59b6', -2.2, 1.8),
    new Ball(canvas.width - 350, 200, 30, '#f1c40f', -1.8, 2.3),
    new Ball(canvas.width - 400, 300, 30, '#e67e22', -2.6, 2.1),
    new Ball(canvas.width - 450, 500, 30, '#1abc9c', -3, 2.7),
    new Ball(canvas.width - 500, 350, 30, '#d35400', -2.1, 2.4),
    new Ball(canvas.width - 550, 250, 30, '#c0392b', -2.4, 2.2),
    new Ball(canvas.width - 600, 450, 30, '#27ae60', -2.8, 1.9),
    new Ball(canvas.width - 650, 150, 30, '#2980b9', -2.3, 2.6),
    new Ball(canvas.width - 700, 300, 30, '#8e44ad', -1.9, 2.8),
    new Ball(canvas.width - 750, 400, 30, '#f39c12', -2.7, 2.0),
    new Ball(canvas.width - 800, 500, 30, '#16a085', -2.5, 2.3),
    new Ball(canvas.width - 850, 350, 30, '#e84393', -2.2, 2.5),
    new Ball(canvas.width - 900, 250, 30, '#2d3436', -2.6, 1.7),
    new Ball(canvas.width - 950, 450, 30, '#d63031', -2.1, 2.4),
    new Ball(canvas.width - 1000, 150, 30, '#00cec9', -2.4, 2.2),
    new Ball(canvas.width - 1050, 300, 30, '#fdcb6e', -2.8, 1.9),
    new Ball(canvas.width - 1100, 400, 30, '#6c5ce7', -2.3, 2.6)
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
