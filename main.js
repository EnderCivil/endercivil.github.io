document.addEventListener('DOMContentLoaded', () => {
    const popover = document.getElementById('popover');
    
    // Show popover only on first launch
    if (!localStorage.getItem('popoverShown')) {
        popover.style.display = 'block';
        setTimeout(() => {
            popover.style.display = 'none';
        }, 5000);
        localStorage.setItem('popoverShown', 'true');
    }

    // Canvas for bouncing balls
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
        new Ball(0, 0, 30, '#ff5555', 4, 3),
        new Ball(0, 0, 30, '#55aaff', -3, 4)
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
