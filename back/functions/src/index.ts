import { setGlobalOptions } from "firebase-functions";
import { config } from 'dotenv';
import { onInit } from 'firebase-functions/v2/core';

function slowInitialization() {
    return new Promise(resolve => {
        setTimeout(() => {
            console.log("slow initialization");
            resolve("Initialized Value");
        }, 40000);
    })
}

config()

let initializedValue;
onInit(async () => {
  initializedValue = await slowInitialization();
  console.log("inicializandolo", initializedValue);
  
});

setGlobalOptions({ maxInstances: 10 })

// section - users
export { login } from './auth/login'
export { signup } from './auth/signup'
export { updateUser } from './auth/upaccount'
export { deleteUser } from './auth/delaccount'
export { getAllAccounts } from './auth/getallac'

// section - products
export { createProduct } from './products/createProduct'
export { listProducts } from './products/listProduct'
export { updateProduct } from './products/updateProduct'
export { deleteProduct } from './products/deleteProduct'

// section - sales
export { registerSale } from './sales/registerSale'

// section - stores
export { stores } from './stores/index'

// section - employees
export { employees } from './employees/index'

// section - reports
export { expenses } from './expenses/index'
export { generateDailyReport } from './daily/daily'
export { daily } from './daily/index'
export { report } from './report/index'