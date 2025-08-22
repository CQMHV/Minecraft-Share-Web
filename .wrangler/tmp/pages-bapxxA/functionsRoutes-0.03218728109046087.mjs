import { onRequestGet as __api_news_js_onRequestGet } from "D:\\29224\\Documents\\My Projects\\Web\\Minecraft Share\\functions\\api\\news.js"
import { onRequestGet as __api_set_lang_index_js_onRequestGet } from "D:\\29224\\Documents\\My Projects\\Web\\Minecraft Share\\functions\\api\\set-lang\\index.js"
import { onRequestPost as __api_set_lang_index_js_onRequestPost } from "D:\\29224\\Documents\\My Projects\\Web\\Minecraft Share\\functions\\api\\set-lang\\index.js"
import { onRequestPost as __indexnow_js_onRequestPost } from "D:\\29224\\Documents\\My Projects\\Web\\Minecraft Share\\functions\\indexnow.js"
import { onRequest as __index_js_onRequest } from "D:\\29224\\Documents\\My Projects\\Web\\Minecraft Share\\functions\\index.js"

export const routes = [
    {
      routePath: "/api/news",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_news_js_onRequestGet],
    },
  {
      routePath: "/api/set-lang",
      mountPath: "/api/set-lang",
      method: "GET",
      middlewares: [],
      modules: [__api_set_lang_index_js_onRequestGet],
    },
  {
      routePath: "/api/set-lang",
      mountPath: "/api/set-lang",
      method: "POST",
      middlewares: [],
      modules: [__api_set_lang_index_js_onRequestPost],
    },
  {
      routePath: "/indexnow",
      mountPath: "/",
      method: "POST",
      middlewares: [],
      modules: [__indexnow_js_onRequestPost],
    },
  {
      routePath: "/",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [__index_js_onRequest],
    },
  ]