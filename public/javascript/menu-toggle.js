document.addEventListener('DOMContentLoaded', function () {
    const toggle = document.getElementById('menu-toggle');
    const navList = document.getElementById('nav-menu');
    const backdrop = document.getElementById('menu-backdrop');

    if (!toggle || !navList || !backdrop) return;

    function toggleMenu() {
        navList.classList.toggle('show');
        backdrop.classList.toggle('show');

        // 自动设置 backdrop 高度 = 菜单内容高度
        if (navList.classList.contains('show')) {
            const height = navList.scrollHeight+20;
            backdrop.style.height = height + 'px';
        } else {
            backdrop.style.height = '0';
        }
    }

    toggle.addEventListener('click', toggleMenu);

    // 可选：点击任意菜单项后关闭菜单
    document.querySelectorAll('#nav-menu li a').forEach(link => {
        link.addEventListener('click', () => {
            navList.classList.remove('show');
            backdrop.classList.remove('show');
            backdrop.style.height = '0';
        });
    });
});
