// Toggle mobile menu
document.querySelector(".hamburger")?.addEventListener("click", () => {
  document.querySelector(".nav")?.classList.toggle("open");
});
// Visible CTA feedback
document.querySelectorAll(".cta, .final button").forEach((btn) => {
  btn.addEventListener("mousedown", () => { btn.style.opacity = "0.5"; });
});