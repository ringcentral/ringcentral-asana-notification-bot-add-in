
  const Sequelize = require('dynamo-sequelize');
  const config = {
    define: {
      timestamps: true
    },
    logging: false,
    throughput: {
      read: process.env.DYNAMO_READ || 20,
      write: process.env.DYNAMO_WRITE || 10
    }
  };
  
  if (process.env.DIALECT === 'dynamodb') {
    config.dialect = 'dynamo';
  } else {
    // Enable SSL for PostgreSQL connections (required by AWS RDS)
    config.dialectOptions = {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    };
  }
  
  const sequelize = new Sequelize(
    process.env.RINGCENTRAL_CHATBOT_DATABASE_CONNECTION_URI,
    config
  );
    
   
  
  exports.sequelize = sequelize;