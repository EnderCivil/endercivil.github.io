// Add fade-out transition when navigating
document.querySelectorAll(".page-link").forEach(link => {
  link.addEventListener("click", function(e) {
    e.preventDefault();
    const url = this.getAttribute("href");

    document.body.classList.add("fade-out");
    setTimeout(() => {
      window.location.href = url;
    }, 500);
  });
});
