import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

/** 
 * Cargar variables de entorno desde el archivo .env
*/ 
config();

/**
 * Seeder para poblar la base de datos con datos de prueba
 * Incluye pedidos de ejemplo para testing
 */
async function runSeeder() {
  console.log(' Iniciando seeder de base de datos...');

  /**
   * Configuración de la fuente de datos TypeORM
   */
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || 'rootpassword',
    database: process.env.DB_DATABASE || 'censudex_orders',
    entities: ['dist/**/*.entity.js'],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log(' Conexión a base de datos establecida');
    const clients = [
      {
        id: uuidv4(),
        name: 'Byron Letelier',
        email: 'byron.letelier@alumnos.ucn.cl',
        address: 'Av. Libertador Bernardo O\'Higgins 123, Santiago',
      },
      {
        id: uuidv4(),
        name: 'María García López',
        email: 'maria.garcia@censudex.cl',
        address: 'Calle Moneda 456, Santiago',
      },
      {
        id: uuidv4(),
        name: 'Pedro Martínez Silva',
        email: 'pedro.martinez@censudex.cl',
        address: 'Av. Providencia 789, Providencia',
      },
    ];

    
    const products = [
      {
        id: uuidv4(),
        name: 'Notebook HP Pavilion 15',
        price: 599990,
        imageUrl: 'https://via.placeholder.com/300x300?text=Notebook+HP',
      },
      {
        id: uuidv4(),
        name: 'Mouse Logitech MX Master 3',
        price: 89990,
        imageUrl: 'https://via.placeholder.com/300x300?text=Mouse+Logitech',
      },
      {
        id: uuidv4(),
        name: 'Teclado Mecánico Keychron K2',
        price: 129990,
        imageUrl: 'https://via.placeholder.com/300x300?text=Teclado+Keychron',
      },
      {
        id: uuidv4(),
        name: 'Monitor Samsung 27" 4K',
        price: 299990,
        imageUrl: 'https://via.placeholder.com/300x300?text=Monitor+Samsung',
      },
      {
        id: uuidv4(),
        name: 'Auriculares Sony WH-1000XM5',
        price: 249990,
        imageUrl: 'https://via.placeholder.com/300x300?text=Auriculares+Sony',
      },
    ];

    console.log(' Creando pedidos de ejemplo...');

    // Ordenes de ejemplo
    const orders = [
      {
        id: uuidv4(),
        client: clients[0],
        items: [
          { product: products[0], quantity: 1 },
          { product: products[1], quantity: 2 },
        ],
        status: 'pendiente',
      },
      {
        id: uuidv4(),
        client: clients[1],
        items: [
          { product: products[2], quantity: 1 },
          { product: products[3], quantity: 1 },
        ],
        status: 'en_procesamiento',
      },
      {
        id: uuidv4(),
        client: clients[2],
        items: [
          { product: products[4], quantity: 1 },
        ],
        status: 'enviado',
      },
      {
        id: uuidv4(),
        client: clients[0],
        items: [
          { product: products[1], quantity: 3 },
          { product: products[2], quantity: 1 },
        ],
        status: 'entregado',
      },
      {
        id: uuidv4(),
        client: clients[1],
        items: [
          { product: products[0], quantity: 1 },
        ],
        status: 'cancelado',
      },
    ];

    for (const order of orders) {
      const total = order.items.reduce((sum, item) => {
        return sum + (item.product.price * item.quantity);
      }, 0);

      const insertOrderResult = await dataSource.query(
        `INSERT INTO orders 
        (id, client_id, client_name, client_email, shipping_address, status, total, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          order.id,
          order.client.id,
          order.client.name,
          order.client.email,
          order.client.address,
          order.status,
          total,
        ]
      );

      console.log(`  ✓ Pedido ${order.id.slice(0, 8)} creado - Estado: ${order.status}`);

      for (const item of order.items) {
        const subtotal = item.product.price * item.quantity;
        
        await dataSource.query(
          `INSERT INTO order_items 
          (id, order_id, product_id, product_name, product_image_url, unit_price, quantity, subtotal, created_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            uuidv4(),
            order.id,
            item.product.id,
            item.product.name,
            item.product.imageUrl,
            item.product.price,
            item.quantity,
            subtotal,
          ]
        );
      }

      console.log(`    - ${order.items.length} items agregados`);
    }

    console.log('\n Seeder completado exitosamente');
    console.log(` Total de pedidos creados: ${orders.length}`);
    console.log(' Puedes usar estos IDs de pedidos para probar los endpoints\n');

    await dataSource.destroy();
  } catch (error) {
    console.error(' Error ejecutando seeder:', error);
    process.exit(1);
  }
}

/**
 * Ejecutar el seeder
 */
runSeeder();