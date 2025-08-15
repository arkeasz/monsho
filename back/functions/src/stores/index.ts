import express from 'express';
import cors from 'cors';
import { onRequest } from 'firebase-functions/v1/https';
import { get_store, get_stores } from './get';
import { create_store } from './create';
import { update_store } from './update';
import { delete_store } from './delete';

const ORIGIN = process.env.WEB_URL || 'http://localhost:3000'

const app = express()
app.use(
  cors({
    origin: ORIGIN,
  })
)

app.use(express.json());

app.get('/', get_stores);

app.get('/:id', get_store);

app.post('/', create_store);

app.put('/:id', update_store);

app.delete('/:id', delete_store);

export const stores = onRequest(app);