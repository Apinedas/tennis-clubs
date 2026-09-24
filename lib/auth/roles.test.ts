import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideRedirect,
  homePath,
  parseContext,
  type AuthContext,
} from "./roles.ts";

const none: AuthContext = { isPlatformAdmin: false, clubCount: 0, clubId: null, roles: [] };
const student: AuthContext = { ...none, clubCount: 1, clubId: "a", roles: ["student"] };
const adminCoach: AuthContext = { ...none, clubCount: 1, clubId: "a", roles: ["admin", "coach"] };
const multi: AuthContext = { ...none, clubCount: 2, clubId: null, roles: [] };
const platform: AuthContext = { ...none, isPlatformAdmin: true };

describe("homePath", () => {
  it("usa la precedencia plataforma > admin > entrenador > alumno", () => {
    assert.equal(homePath(platform), "/platform");
    assert.equal(homePath({ ...adminCoach, isPlatformAdmin: true }), "/platform");
    assert.equal(homePath(adminCoach), "/admin");
    assert.equal(homePath({ ...student, roles: ["student", "coach"] }), "/coach");
    assert.equal(homePath(student), "/student");
  });
  it("sin club activo: elegir o sin club", () => {
    assert.equal(homePath(multi), "/select-club");
    assert.equal(homePath(none), "/no-club");
  });
});

describe("decideRedirect sin sesión", () => {
  it("deja pasar las páginas públicas", () => {
    for (const p of ["/login", "/register", "/invitation/abc", "/auth/confirm", "/club/el-rodadero"]) {
      assert.equal(decideRedirect(p, "", null), null, p);
    }
  });
  it("manda a login conservando el destino", () => {
    assert.equal(decideRedirect("/", "", null), "/login");
    assert.equal(decideRedirect("/admin", "", null), "/login?next=%2Fadmin");
    assert.equal(decideRedirect("/join/x", "?a=1", null), "/login?next=%2Fjoin%2Fx%3Fa%3D1");
  });
});

describe("decideRedirect con sesión", () => {
  it("/ y las páginas de invitado llevan al inicio del rol", () => {
    assert.equal(decideRedirect("/", "", student), "/student");
    assert.equal(decideRedirect("/login", "", adminCoach), "/admin");
    assert.equal(decideRedirect("/register", "", platform), "/platform");
  });
  it("un rol no entra al área de otro", () => {
    assert.equal(decideRedirect("/admin", "", student), "/student");
    assert.equal(decideRedirect("/platform", "", adminCoach), "/admin");
    assert.equal(decideRedirect("/student", "", adminCoach), "/admin");
  });
  it("con varios roles entra a cualquiera de sus áreas", () => {
    assert.equal(decideRedirect("/admin", "", adminCoach), null);
    assert.equal(decideRedirect("/coach", "", adminCoach), null);
    assert.equal(decideRedirect("/admin/canchas", "", adminCoach), null);
  });
  it("no confunde prefijos parecidos", () => {
    assert.equal(decideRedirect("/administracion", "", student), null);
  });
  it("sin club activo todas las áreas redirigen a elegir o a sin club", () => {
    assert.equal(decideRedirect("/admin", "", multi), "/select-club");
    assert.equal(decideRedirect("/admin", "", none), "/no-club");
  });
  it("select-club y no-club no rebotan entre sí", () => {
    assert.equal(decideRedirect("/select-club", "", multi), null);
    assert.equal(decideRedirect("/select-club", "", student), null);
    assert.equal(decideRedirect("/select-club", "", none), "/no-club");
    assert.equal(decideRedirect("/no-club", "", none), null);
    assert.equal(decideRedirect("/no-club", "", student), "/student");
    assert.equal(decideRedirect("/no-club", "", platform), "/platform");
  });
  it("el enlace de registro de un club con sesión lleva a unirse", () => {
    assert.equal(decideRedirect("/register", "?club=el-rodadero", student), "/join/el-rodadero");
  });
  it("invitaciones y confirmación siguen accesibles con sesión", () => {
    assert.equal(decideRedirect("/invitation/abc", "", none), null);
    assert.equal(decideRedirect("/auth/confirm", "?code=1", student), null);
    assert.equal(decideRedirect("/join/x", "", none), null);
  });
  it("el microsite público es visible con o sin sesión, incluso admin", () => {
    assert.equal(decideRedirect("/club/el-rodadero", "", null), null);
    assert.equal(decideRedirect("/club/el-rodadero", "", adminCoach), null);
  });
});

describe("parseContext", () => {
  it("lee los claims del hook", () => {
    assert.deepEqual(
      parseContext({ is_platform_admin: true, club_count: 2, club_id: "c", club_roles: ["admin", "student"] }),
      { isPlatformAdmin: true, clubCount: 2, clubId: "c", roles: ["admin", "student"] },
    );
  });
  it("sin hook o con datos raros no da permisos", () => {
    assert.deepEqual(parseContext({}), none);
    assert.deepEqual(
      parseContext({ is_platform_admin: "true", club_count: "3", club_id: "c", club_roles: ["root", 1, "admin"] }),
      { isPlatformAdmin: false, clubCount: 0, clubId: "c", roles: ["admin"] },
    );
  });
  it("ignora los roles si no hay club activo", () => {
    assert.deepEqual(parseContext({ club_id: null, club_roles: ["admin"], club_count: 2 }).roles, []);
  });
});
