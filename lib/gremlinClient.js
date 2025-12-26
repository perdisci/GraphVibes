import gremlin from 'gremlin';

const TraversalSource = gremlin.process.TraversalSource;
const DriverRemoteConnection = gremlin.driver.DriverRemoteConnection;

let g;
let connection;

export const connect = () => {
    if (g) return g;

    const url = process.env.GREMLIN_ENDPOINT || 'ws://localhost:8182/gremlin';

    connection = new DriverRemoteConnection(url);
    g = TraversalSource.traversal().withRemote(connection);

    return g;
};

export const closeConnection = async () => {
    if (connection) {
        await connection.close();
        g = null;
        connection = null;
    }
}
