import * as crypto from 'better-auth/crypto';

async function test() {
    try {
        console.log(await crypto.hashPassword("Admin123!"));
        console.log(await crypto.hashPassword("Owner123!"));
        console.log(await crypto.hashPassword("Cashier123!"));
    } catch (e) {
        console.error(e);
    }
}
test();
